#!/usr/bin/env node
'use strict';

/**
 * commit_push.cjs — Cursor Agent「提交推送」的标准化实现
 *
 * 功能：
 *   1. 采集 git 变更（status / diff / log）
 *   2. 按 --file 传入的路径分组到各 git 仓库，在每个仓库分别 commit/push
 *   3. 拦截疑似密钥文件；自动维护子项目与根项目 VERSION / CHANGELOG.md
 *   4. 推送前检测远端是否存在；缺失时询问用户是否用 gh 建仓（默认 private）
 *   5. 执行完成后打印操作报告（各仓动作、提交哈希、升版、推送结果）
 *
 * Skill 路径：~/.cursor/skills/commit-push/scripts/commit_push.cjs
 *
 * 用法：
 *   node ~/.cursor/skills/commit-push/scripts/commit_push.cjs \
 *     --intent="修改目的"       # 从对话归纳（必填，不要堆文件名）
 *     --file=/abs/path/foo.cjs  # 本次修改的文件（可重复）；多仓库自动分组
 *     --file=/abs/path/bar.md
 *     --dry-run                 # 预览，不写 git
 *     --yes                     # 非交互跳过确认（Agent 必加）
 *
 * 其他常用参数：
 *   -m="完整 subject"     指定 commit 标题（跳过启发式生成）
 *   --files=a,b,c         逗号分隔修改文件
 *   --cwd=<path>          指定 git 仓库根（无 --file 时用此仓；相对路径的基准）
 *   --no-push             只提交，不推送
 *   --no-proxy            推送不走代理
 *   --proxy=<url>         覆盖默认代理（127.0.0.1:1087）
 *   --create-remote       用户已同意时自动 gh repo create（默认 private）
 *   --github-public       建仓为 public
 *   --github-owner=<u>    建仓 owner
 *   --github-repo=<name>  建仓仓库名（默认目录名 slug）
 *   --remote=<name>       git remote 名（默认 origin）
 *   --branch=<name>       push 分支（默认当前分支）
 *   --json-report         仅输出 JSON 分析报告，不执行 git
 *
 * 推送代理（默认开启）：
 *   未设 --no-proxy 且环境未配置时，使用 DEFAULT_PUSH_PROXY（127.0.0.1:1087）
 *   --proxy= 覆盖；已 export 的 http_proxy/https_proxy 优先于默认值
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const githubRemote = require('./github_remote.cjs');

const SECRET_BLOCKLIST = [
  'config.env',
  '/.env',
  '.env.',
  'credentials',
  '.pem',
  '.key',
];

const WALK_SKIP_DIRS = new Set(['.git', 'node_modules', '_recovery', '_projects']);
const DEFAULT_VERSION_META = new Set([
  'VERSION',
  'CHANGELOG.md',
  'package.json',
  'pipeline-manifest.json',
]);
const INITIAL_VERSION = '0.1.0';

const SUBJECT_MAX = 72;
const BODY_MAX_LINES = 24;
const DIFF_EXCERPT_LINES = 8;

/** 推送前默认代理（可用 --no-proxy 关闭，或 --proxy= 覆盖） */
const DEFAULT_PUSH_PROXY = 'http://127.0.0.1:1087';

// ── CLI ───────────────────────────────────────────────────────────

function findGitRoot(startDir) {
  let cur = path.resolve(startDir);
  for (let i = 0; i < 24; i++) {
    if (fs.existsSync(path.join(cur, '.git'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(startDir);
}

/** 路径是否落在 scope 内（scope 为空表示全仓） */
function pathMatchesScope(filePath, scopePaths) {
  if (!scopePaths || scopePaths.length === 0) return true;
  const norm = String(filePath || '').replace(/\\/g, '/');
  for (const scope of scopePaths) {
    const s = String(scope || '').replace(/\\/g, '/');
    if (s === '.' || s === '') return true;
    if (norm === s || norm.startsWith(`${s}/`)) return true;
  }
  return false;
}

/**
 * 将对话/CLI 传入的修改文件按 git 仓库根分组。
 * @returns {{ repoRoot: string, scopePaths: string[], skipped: object[] }[]}
 */
function resolveRepoTargets(opts) {
  const skipped = [];
  const files = [...opts.scopeFiles];

  if (files.length === 0) {
    const cwd = path.resolve(opts.cwd || process.cwd());
    const root = findGitRoot(cwd);
    if (!fs.existsSync(path.join(root, '.git'))) return { targets: [], skipped };
    return {
      targets: [{ repoRoot: root, scopePaths: [] }],
      skipped,
    };
  }

  const baseCwd = path.resolve(opts.cwd || process.cwd());
  const byRoot = new Map();
  for (const fp of files) {
    const abs = path.isAbsolute(fp) ? fp : path.resolve(baseCwd, fp);
    if (!fs.existsSync(abs)) {
      skipped.push({ path: fp, reason: 'not_found' });
      continue;
    }
    const root = findGitRoot(abs);
    if (!fs.existsSync(path.join(root, '.git'))) {
      skipped.push({ path: fp, reason: 'no_git' });
      continue;
    }
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    const relForBlock = fs.statSync(abs).isDirectory() ? rel : rel;
    if (relForBlock && isBlockedPath(relForBlock)) {
      skipped.push({ path: fp, reason: 'blocked' });
      continue;
    }
    if (!byRoot.has(root)) byRoot.set(root, new Set());
    if (fs.statSync(abs).isDirectory()) {
      byRoot.get(root).add(rel === '' ? '.' : rel);
    } else {
      byRoot.get(root).add(rel);
    }
  }

  // 当前项目（opts.cwd 所在仓库）排在最前面，优先处理
  const cwdRoot = findGitRoot(baseCwd);
  const targets = [...byRoot.entries()]
    .sort(([a], [b]) => {
      if (a === cwdRoot) return -1;
      if (b === cwdRoot) return 1;
      return 0;
    })
    .map(([repoRoot, relSet]) => ({
      repoRoot,
      scopePaths: [...relSet],
    }));
  return { targets, skipped };
}

function applyScopeToSnapshot(snapshot, scopePaths) {
  if (!scopePaths.length) return snapshot;
  const nameStatus = snapshot.nameStatus.filter((x) => pathMatchesScope(x.path, scopePaths));
  const statusPorcelain = snapshot.statusPorcelain.filter((line) => {
    let p = line.slice(3).trim();
    if (p.includes(' -> ')) p = p.split(' -> ').pop().trim();
    return pathMatchesScope(p, scopePaths);
  });
  return {
    ...snapshot,
    nameStatus,
    statusPorcelain,
    hasChanges: nameStatus.length > 0 || statusPorcelain.length > 0,
  };
}

function parseArgs(argv) {
  const out = {
    intent: null,
    message: null,
    dryRun: false,
    noPush: false,
    yes: false,
    jsonReport: false,
    proxy: null,
    noProxy: false,
    createRemote: false,
    githubVisibility: 'private',
    githubOwner: null,
    githubRepo: null,
    cwd: findGitRoot(process.cwd()),
    remote: 'origin',
    branch: null,
    addAll: true,
    scopeFiles: [],
  };
  for (const raw of argv) {
    if (raw === '--dry-run') out.dryRun = true;
    else if (raw === '--no-push') out.noPush = true;
    else if (raw === '--no-proxy') out.noProxy = true;
    else if (raw === '--create-remote') out.createRemote = true;
    else if (raw === '--github-public') out.githubVisibility = 'public';
    else if (raw === '--github-private') out.githubVisibility = 'private';
    else if (raw.startsWith('--github-visibility=')) {
      const v = raw.slice('--github-visibility='.length).trim().toLowerCase();
      out.githubVisibility = v === 'public' ? 'public' : 'private';
    }
    else if (raw.startsWith('--github-owner=')) out.githubOwner = raw.slice('--github-owner='.length).trim();
    else if (raw.startsWith('--github-repo=')) out.githubRepo = raw.slice('--github-repo='.length).trim();
    else if (raw === '--yes' || raw === '-y') out.yes = true;
    else if (raw === '--json-report') out.jsonReport = true;
    else if (raw === '--no-add-all') out.addAll = false;
    else if (raw.startsWith('--intent=')) out.intent = raw.slice('--intent='.length).trim();
    else if (raw.startsWith('-m=')) out.message = raw.slice(3).trim();
    else if (raw.startsWith('--message=')) out.message = raw.slice('--message='.length).trim();
    else if (raw.startsWith('--proxy=')) out.proxy = raw.slice('--proxy='.length).trim();
    else if (raw.startsWith('--cwd=')) out.cwd = path.resolve(raw.slice('--cwd='.length));
    else if (raw.startsWith('--remote=')) out.remote = raw.slice('--remote='.length).trim();
    else if (raw.startsWith('--branch=')) out.branch = raw.slice('--branch='.length).trim();
    else if (raw.startsWith('--file=')) out.scopeFiles.push(raw.slice('--file='.length).trim());
    else if (raw.startsWith('--files=')) {
      for (const part of raw.slice('--files='.length).split(',')) {
        const p = part.trim();
        if (p) out.scopeFiles.push(p);
      }
    }
    else if (!raw.startsWith('-') && raw !== 'commit_push.cjs') {
      out.scopeFiles.push(raw);
    } else if (raw === '-h' || raw === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 46).join('\n'));
      process.exit(0);
    }
  }
  return out;
}

// ── Git 封装 ──────────────────────────────────────────────────────

function git(cwd, args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    env: opts.env || process.env,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trimEnd(),
    stderr: (r.stderr || '').trimEnd(),
  };
}

function gitLines(cwd, args) {
  const r = git(cwd, args);
  if (!r.ok && r.stderr) return { ok: false, lines: [], error: r.stderr };
  return { ok: true, lines: r.stdout ? r.stdout.split('\n').filter(Boolean) : [] };
}

function isBlockedPath(filePath) {
  const norm = String(filePath).replace(/\\/g, '/');
  if (norm.endsWith('.template')) return false;
  return SECRET_BLOCKLIST.some((s) => norm.includes(s));
}

// ── 阶段 1：采集（对齐 Agent 并行 git status / diff / log）────────

function collectGitSnapshot(repoRoot) {
  const branch =
    git(repoRoot, ['branch', '--show-current']).stdout || 'HEAD';
  const upstream = git(repoRoot, ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]);
  const hasUpstream = upstream.ok;

  const statusPorcelain = gitLines(repoRoot, ['status', '--porcelain']);
  const diffStat = git(repoRoot, ['diff', '--stat']);
  const diffCachedStat = git(repoRoot, ['diff', '--cached', '--stat']);
  const nameStatus = gitLines(repoRoot, ['diff', '--name-status', 'HEAD']);
  const nameStatusCached = gitLines(repoRoot, ['diff', '--cached', '--name-status']);
  const untracked = gitLines(repoRoot, ['ls-files', '--others', '--exclude-standard']);
  const logRecent = gitLines(repoRoot, ['log', '-5', '--oneline']);

  // 未推送的本地提交数（有 upstream 时）
  let unpushedCount = 0;
  if (hasUpstream) {
    const unpushed = git(repoRoot, ['rev-list', '--count', `${upstream.stdout}..HEAD`]);
    if (unpushed.ok) unpushedCount = parseInt(unpushed.stdout, 10) || 0;
  }

  const combinedNameStatus = mergeNameStatus(
    nameStatus.lines,
    nameStatusCached.lines,
    statusPorcelain.lines,
    untracked.lines
  );

  const hasWorkingChanges =
    statusPorcelain.lines.length > 0 ||
    diffStat.stdout.length > 0 ||
    diffCachedStat.stdout.length > 0;

  return {
    repoRoot,
    branch,
    hasUpstream,
    upstream: hasUpstream ? upstream.stdout : null,
    unpushedCount,
    hasPendingPush: unpushedCount > 0,
    statusPorcelain: statusPorcelain.lines,
    diffStat: diffStat.stdout,
    diffCachedStat: diffCachedStat.stdout,
    nameStatus: combinedNameStatus,
    logRecent: logRecent.lines,
    hasChanges: hasWorkingChanges,
  };
}

function mergeNameStatus(diffHead, diffCached, porcelain, untrackedFiles) {
  const map = new Map();

  function ingest(line) {
    const m = line.match(/^([AMDRTUC?])\s+(.+?)(?:\s+->\s+(.+))?$/);
    if (!m) return;
    const code = m[1];
    const p = (m[3] || m[2]).trim();
    if (!p || isBlockedPath(p)) return;
    const prev = map.get(p);
    if (!prev || code === 'D') map.set(p, { code, path: p });
    else if (!prev) map.set(p, { code, path: p });
    else map.set(p, { code: prev.code === '?' ? code : prev.code, path: p });
  }

  for (const line of [...diffHead, ...diffCached]) ingest(line);
  for (const line of porcelain) {
    const code = line.slice(0, 2);
    let rest = line.slice(3).trim();
    if (rest.includes(' -> ')) rest = rest.split(' -> ').pop().trim();
    if (!rest || isBlockedPath(rest)) continue;
    let st = '?';
    if (code === '??') st = 'A';
    else if (code.includes('D')) st = 'D';
    else if (code.includes('R')) st = 'R';
    else if (code.includes('A')) st = 'A';
    else st = 'M';
    map.set(rest, { code: st, path: rest });
  }
  for (const p of untrackedFiles) {
    if (!isBlockedPath(p) && !map.has(p)) map.set(p, { code: 'A', path: p });
  }
  return [...map.values()];
}

// ── 阶段 2：分析（文件集 + 目录聚类 + 启发式目的）────────────────

function topLevelDir(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts.length > 1 ? parts[0] : '.';
}

function analyzeChanges(snapshot) {
  const byCode = { A: [], M: [], D: [], R: [], other: [] };
  const byDir = new Map();

  for (const { code, path: p } of snapshot.nameStatus) {
    const bucket = byCode[code] || byCode.other;
    bucket.push(p);
    const dir = topLevelDir(p);
    byDir.set(dir, (byDir.get(dir) || 0) + 1);
  }

  const dirs = [...byDir.entries()].sort((a, b) => b[1] - a[1]);
  const hints = [];

  if (byCode.R.length > 0 || snapshot.nameStatus.some((x) => /rename/i.test(x.path))) {
    hints.push('rename/refactor');
  }
  if (byCode.A.length > 5 && byCode.M.length === 0 && byCode.D.length === 0) {
    hints.push('initial or bulk add');
  }
  if (snapshot.nameStatus.some((x) => /self-test|\.cjs$/.test(x.path))) {
    hints.push('scripts/tests');
  }
  if (snapshot.nameStatus.some((x) => /docs\/|\.md$/.test(x.path))) {
    hints.push('documentation');
  }
  if (snapshot.nameStatus.some((x) => /schemas\/|templates\//.test(x.path))) {
    hints.push('spec/templates');
  }

  const total = snapshot.nameStatus.length;
  const primaryDirs = dirs.slice(0, 4).map(([d, n]) => `${d}(${n})`);

  return {
    total,
    byCode,
    dirs,
    primaryDirs,
    hints,
    blockedInPorcelain: snapshot.statusPorcelain
      .map((l) => l.slice(3).trim())
      .filter((p) => isBlockedPath(p)),
  };
}

function diffExcerpt(repoRoot, maxFiles = 5) {
  const r = git(repoRoot, ['diff', '--unified=0', 'HEAD']);
  if (!r.stdout) return [];
  const excerpts = [];
  let current = null;
  let lineCount = 0;
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current && lineCount > 0) excerpts.push(current);
      if (excerpts.length >= maxFiles) break;
      current = { file: line.replace(/^diff --git a\//, '').split(' b/')[0] || line, lines: [] };
      lineCount = 0;
      continue;
    }
    if (!current) continue;
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+') || line.startsWith('-')) {
      if (lineCount < DIFF_EXCERPT_LINES) {
        current.lines.push(line.slice(0, 120));
        lineCount++;
      }
    }
  }
  if (current && excerpts.length < maxFiles) excerpts.push(current);
  return excerpts;
}

// ── 阶段 3：生成 commit message（--intent / -m 优先）──────────────

function conventionalPrefix(analysis) {
  if (analysis.hints.includes('documentation')) return 'docs';
  if (analysis.hints.includes('rename/refactor')) return 'refactor';
  if (analysis.byCode.A.length && !analysis.byCode.M.length) return 'chore';
  if (analysis.hints.includes('scripts/tests')) return 'test';
  return 'chore';
}

function buildCommitMessage(snapshot, analysis, opts) {
  if (opts.message) {
    return { subject: opts.message.split('\n')[0], body: opts.message.split('\n').slice(1).join('\n').trim() };
  }

  const prefix = conventionalPrefix(analysis);
  let subject;

  if (opts.intent) {
    subject = opts.intent.replace(/\s+/g, ' ').trim();
    if (subject.length > SUBJECT_MAX) subject = subject.slice(0, SUBJECT_MAX - 1) + '…';
  } else if (analysis.total === 0) {
    subject = 'chore: empty commit guard';
  } else if (analysis.hints.includes('rename/refactor')) {
    subject = `${prefix}: update ${analysis.primaryDirs.join(', ')}`;
  } else {
    subject = `${prefix}: ${analysis.primaryDirs.slice(0, 2).join(', ')} (${analysis.total} files)`;
  }

  const bodyLines = [];
  bodyLines.push(`Changed: ${analysis.total} file(s).`);
  if (analysis.primaryDirs.length) bodyLines.push(`Areas: ${analysis.primaryDirs.join(', ')}.`);
  if (analysis.hints.length) bodyLines.push(`Hints: ${analysis.hints.join(', ')}.`);
  if (analysis.byCode.A.length) bodyLines.push(`Added: ${analysis.byCode.A.length}, Modified: ${analysis.byCode.M.length}, Deleted: ${analysis.byCode.D.length}.`);
  if (snapshot.logRecent.length) {
    bodyLines.push('', 'Recent commits:', ...snapshot.logRecent.map((l) => `  ${l}`));
  }
  const excerpts = diffExcerpt(snapshot.repoRoot, 3);
  if (excerpts.length) {
    bodyLines.push('', 'Diff excerpt:');
    for (const ex of excerpts) {
      bodyLines.push(`  ${ex.file}:`);
      for (const ln of ex.lines) bodyLines.push(`    ${ln}`);
    }
  }

  return {
    subject,
    body: bodyLines.slice(0, BODY_MAX_LINES).join('\n'),
  };
}

// ── 阶段 4：stage / commit / push ─────────────────────────────────

function applyProxy(proxyUrl) {
  if (!proxyUrl) return;
  process.env.http_proxy = proxyUrl;
  process.env.https_proxy = proxyUrl;
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
}

/** 解析推送用代理：--no-proxy > 已有 env > --proxy > 默认 */
function resolvePushProxy(opts) {
  if (opts.noProxy) return null;
  const fromFlag = opts.proxy && String(opts.proxy).trim();
  if (fromFlag) return fromFlag;
  const fromEnv =
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY ||
    '';
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return DEFAULT_PUSH_PROXY;
}

function stageFiles(repoRoot, analysis, opts) {
  const scoped = opts.scopePaths && opts.scopePaths.length > 0;
  let toAdd;
  if (scoped) {
    toAdd = analysis.byCode.A.concat(
      analysis.byCode.M,
      analysis.byCode.R,
      analysis.byCode.other
    ).concat(
      gitLines(repoRoot, ['ls-files', '--deleted']).lines.filter(
        (p) => !isBlockedPath(p) && pathMatchesScope(p, opts.scopePaths)
      )
    );
  } else {
    toAdd = analysis.byCode.A.concat(analysis.byCode.M, analysis.byCode.R, analysis.byCode.other).concat(
      gitLines(repoRoot, ['ls-files', '--deleted']).lines.filter((p) => !isBlockedPath(p))
    );
  }

  const unique = [...new Set(toAdd.filter((p) => p && !isBlockedPath(p)))];
  if (unique.length === 0 && opts.addAll && !scoped) {
    const r = git(repoRoot, ['add', '-A']);
    return { ok: r.ok, files: ['-A'], error: r.stderr, mode: 'all' };
  }
  for (const f of unique) {
    const r = git(repoRoot, ['add', '--', f]);
    if (!r.ok) return { ok: false, files: unique, error: r.stderr, mode: scoped ? 'scope' : 'paths' };
  }
  return { ok: true, files: unique, mode: scoped ? 'scope' : unique.length ? 'paths' : 'none' };
}

function commit(repoRoot, subject, body, dryRun) {
  const full = body ? `${subject}\n\n${body}` : subject;
  if (dryRun) return { ok: true, message: full };
  const r = spawnSync('git', ['commit', '-m', full], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return { ok: r.status === 0, message: full };
}

/**
 * 推送前同步：fetch → 检测远端是否领先 → 若领先则 pull --no-rebase 合并
 * 若 fetch/pull 失败，exit(1)；fetch 失败时仅警告并继续（可能首次推送）。
 */
function syncWithRemote(repoRoot, remote, branch, proxy) {
  const br = branch || git(repoRoot, ['branch', '--show-current']).stdout;

  const env = Object.assign({}, process.env);
  if (proxy) {
    env.http_proxy = proxy;
    env.https_proxy = proxy;
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
  }

  console.log(`\n正在 fetch ${remote}，检查远端是否有新提交...`);
  const fetchResult = git(repoRoot, ['fetch', remote], { env });
  if (!fetchResult.ok) {
    console.warn(`  fetch 失败（${fetchResult.stderr.slice(0, 120)}），将尝试直接推送。`);
    return;
  }

  const behindResult = git(repoRoot, ['rev-list', `HEAD..${remote}/${br}`, '--count'], { env });
  const behind = parseInt(behindResult.stdout, 10);

  if (!behindResult.ok || isNaN(behind) || behind === 0) {
    console.log('  远端无新提交，直接推送。');
    return;
  }

  console.log(`  远端领先本地 ${behind} 个提交，正在执行 git pull --no-rebase 合并...`);
  const pullResult = spawnSync('git', ['pull', '--no-rebase', remote, br], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    env,
  });
  if (pullResult.status !== 0) {
    console.error('\ngit pull 合并失败，请手动解决冲突后重试推送。');
    process.exit(1);
  }
  console.log('  合并完成。');
}

function pushEnv(proxy) {
  const env = Object.assign({}, process.env);
  if (proxy) {
    env.http_proxy = proxy;
    env.https_proxy = proxy;
    env.HTTP_PROXY = proxy;
    env.HTTPS_PROXY = proxy;
  }
  return env;
}

/**
 * 推送前确保 GitHub 远端可用；缺失时提示选项，用户同意（或 --create-remote）则 gh 建仓。
 * 不调用 process.exit，所有失败通过 done(new Error(...), null) 传出，由调用方决定是否中止。
 * @param {(err: Error|null, result?: object) => void} done
 */
function ensureRemoteBeforePush(repoRoot, opts, pushProxy, done) {
  const env = pushEnv(pushProxy);
  const status = githubRemote.assessRemoteStatus(repoRoot, {
    remote: opts.remote,
    githubOwner: opts.githubOwner,
    githubRepo: opts.githubRepo,
    env,
  });

  if (!status.needsCreate || status.state === 'ok') {
    return done(null, status);
  }

  if (opts.dryRun) {
    githubRemote.printRemoteProvisionPreview(status, opts);
    return done(null, { ...status, dryRun: true, wouldCreate: true });
  }

  githubRemote.printRemoteOptions(status, opts);

  const block = githubRemote.remoteBlockReason(status);
  if (block) {
    const msg = `无法自动建仓：${block}。请手动配置 git remote，或使用 --no-push 仅提交。`;
    console.error(`\n${msg}`);
    return done(new Error(msg), null);
  }

  const runCreate = () => {
    console.log(`\n正在创建 GitHub 仓库（${githubRemote.visibilityLabel(opts)}）: ${status.fullName} …`);
    const result = githubRemote.createGithubRemote(repoRoot, {
      remote: opts.remote,
      githubOwner: opts.githubOwner,
      githubRepo: opts.githubRepo,
      githubVisibility: opts.githubVisibility,
      env,
    });
    if (!result.ok) {
      const msg = `建仓失败: ${result.detail || result.reason || '未知错误'}`;
      console.error(msg);
      return done(new Error(msg), null);
    }
    console.log(
      result.created
        ? `已创建并配置 remote "${opts.remote}": ${result.fullName}`
        : `已复用已有仓库并配置 remote "${opts.remote}": ${result.fullName}`
    );
    done(null, { ...status, state: 'ok', created: result.created, remote_url: result.remote_url });
  };

  if (opts.createRemote) {
    return runCreate();
  }

  if (opts.yes) {
    const msg = `远端不可用。用户已同意建仓时请同时加上 --create-remote。\n  示例: --create-remote --yes`;
    console.error(`\n${msg}`);
    return done(new Error(msg), null);
  }

  const readline = require('readline');
  const vis = githubRemote.visibilityLabel(opts);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(
    `\n是否用 gh 创建 ${vis} 仓库 "${status.fullName}" 并继续推送? [y/N] `,
    (ans) => {
      rl.close();
      if (!/^y(es)?$/i.test(String(ans).trim())) {
        const msg = '用户取消推送。可手动配置 remote 后重试，或加 --no-push 仅提交。';
        console.log(msg);
        return done(new Error(msg), null);
      }
      runCreate();
    }
  );
}

function push(repoRoot, remote, branch, dryRun, env) {
  const br = branch || git(repoRoot, ['branch', '--show-current']).stdout;
  const args = ['push', '-u', remote, br];
  if (dryRun) return { ok: true, cmd: `git ${args.join(' ')}` };
  const r = git(repoRoot, args, { inherit: true, env: env || process.env });
  return { ok: r.ok, error: r.stderr };
}

// ── 自动版本维护（子项目优先；根项目最后）────────────────────────

function pickExport(mod, names) {
  for (const name of names) {
    if (typeof mod[name] === 'function') return mod[name];
  }
  return null;
}

/** 在仓库内查找 scripts/libs/pipeline-version.cjs（不硬编码项目目录名） */
function findPipelineVersionModulePath(repoRoot) {
  const root = path.resolve(repoRoot);
  const matches = [];

  function walk(dir, depth) {
    if (depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      if (ent.isDirectory()) {
        if (WALK_SKIP_DIRS.has(ent.name)) continue;
        walk(path.join(dir, ent.name), depth + 1);
        continue;
      }
      if (ent.name !== 'pipeline-version.cjs') continue;
      const full = path.join(dir, ent.name);
      const norm = full.replace(/\\/g, '/');
      if (norm.includes('/scripts/libs/pipeline-version.cjs')) {
        matches.push(full);
      }
    }
  }

  walk(root, 0);
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
  return matches[0];
}

/** 从 pipeline-version.cjs 向上查找 VERSION，推导 skill 相对前缀 */
function resolveVersionContext(repoRoot, modPath) {
  const root = path.resolve(repoRoot);
  let dir = path.dirname(modPath);
  while (dir.startsWith(root)) {
    const versionFile = path.join(dir, 'VERSION');
    if (fs.existsSync(versionFile)) {
      const rel = path.relative(root, dir).replace(/\\/g, '/');
      return {
        versionFile,
        skillPrefix: rel === '.' || rel === '' ? '' : rel,
      };
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return null;
}

function resolveGenericSkillVersionContext(repoRoot, snapshot) {
  const root = path.resolve(repoRoot);
  const counts = new Map();
  const paths = snapshot && Array.isArray(snapshot.nameStatus)
    ? snapshot.nameStatus.map((x) => x.path).filter(Boolean)
    : [];

  function addCandidate(dir) {
    const full = path.resolve(dir);
    if (!full.startsWith(root)) return false;
    if (!fs.existsSync(path.join(full, 'SKILL.md'))) return false;
    counts.set(full, (counts.get(full) || 0) + 1);
    return true;
  }

  if (paths.length === 0) {
    addCandidate(root);
  }

  for (const relPath of paths) {
    const norm = String(relPath || '').replace(/\\/g, '/');
    let cur = path.dirname(path.join(root, norm));
    if (path.basename(norm) === 'SKILL.md' || path.basename(norm) === 'VERSION' || path.basename(norm) === 'CHANGELOG.md') {
      cur = path.join(root, path.dirname(norm));
    }
    while (cur.startsWith(root)) {
      if (addCandidate(cur)) break;
      if (cur === root) break;
      cur = path.dirname(cur);
    }
  }

  const candidates = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].length - b[0].length;
  });
  if (candidates.length === 0) return null;
  if (candidates.length > 1 && candidates[0][1] === candidates[1][1]) {
    console.warn('警告: 检测到多个 skill VERSION 候选，跳过通用 skill 升版。请用 --file 缩小范围。');
    return null;
  }

  const dir = candidates[0][0];
  const rel = path.relative(root, dir).replace(/\\/g, '/');
  return {
    versionFile: path.join(dir, 'VERSION'),
    changelogFile: path.join(dir, 'CHANGELOG.md'),
    skillPrefix: rel === '.' || rel === '' ? '' : rel,
  };
}

function isChildOf(parent, child) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function hasVersionableMarker(dir, repoRoot) {
  if (!dir || !String(dir).startsWith(path.resolve(repoRoot))) return false;
  if (fs.existsSync(path.join(dir, 'SKILL.md'))) return true;
  return path.resolve(dir) === path.resolve(repoRoot);
}

function discoverVersionableContexts(repoRoot, snapshot) {
  const root = path.resolve(repoRoot);
  const changedPaths = snapshot && Array.isArray(snapshot.nameStatus)
    ? snapshot.nameStatus.map((x) => x.path).filter(Boolean)
    : [];
  const dirs = new Map();

  function add(dir, reason) {
    const full = path.resolve(dir);
    if (!full.startsWith(root)) return false;
    if (!hasVersionableMarker(full, root)) return false;
    const rel = path.relative(root, full).replace(/\\/g, '/');
    const skillPrefix = rel === '.' || rel === '' ? '' : rel;
    const current = dirs.get(full) || { dir: full, skillPrefix, reasons: new Set() };
    current.reasons.add(reason);
    dirs.set(full, current);
    return true;
  }

  for (const relPath of changedPaths) {
    const norm = String(relPath || '').replace(/\\/g, '/');
    let cur = path.dirname(path.join(root, norm));
    if (DEFAULT_VERSION_META.has(path.basename(norm)) || path.basename(norm) === 'SKILL.md') {
      cur = path.join(root, path.dirname(norm));
    }
    while (cur.startsWith(root)) {
      if (add(cur, 'changed-path')) break;
      if (cur === root) break;
      cur = path.dirname(cur);
    }
  }

  add(root, 'repo-root');

  return [...dirs.values()]
    .sort((a, b) => {
      const aRoot = a.skillPrefix === '';
      const bRoot = b.skillPrefix === '';
      if (aRoot !== bRoot) return aRoot ? 1 : -1;
      const depthA = a.skillPrefix ? a.skillPrefix.split('/').length : 0;
      const depthB = b.skillPrefix ? b.skillPrefix.split('/').length : 0;
      if (depthA !== depthB) return depthB - depthA;
      return a.skillPrefix.localeCompare(b.skillPrefix);
    })
    .map((ctx) => ({
      type: ctx.skillPrefix ? 'subproject' : 'project',
      dir: ctx.dir,
      versionFile: path.join(ctx.dir, 'VERSION'),
      changelogFile: path.join(ctx.dir, 'CHANGELOG.md'),
      skillPrefix: ctx.skillPrefix,
      label: ctx.skillPrefix || path.basename(root),
    }));
}

function createPathAdapter(mod) {
  const isSkillRepoPath =
    pickExport(mod, ['isSkillRepoPath', 'isPifSkillRepoPath', 'isStd4SkillRepoPath']) ||
    defaultIsSkillRepoPath;
  const isVersionMetaOnlyPath =
    pickExport(mod, ['isVersionMetaOnlyPath', 'isPifVersionMetaOnlyPath', 'isStd4VersionMetaOnlyPath']) ||
    defaultIsVersionMetaOnlyPath;
  return { isSkillRepoPath, isVersionMetaOnlyPath };
}

function defaultIsSkillRepoPath(filePath, skillPrefix) {
  const norm = String(filePath || '').replace(/\\/g, '/');
  if (skillPrefix === '') return true;
  return norm === skillPrefix || norm.startsWith(`${skillPrefix}/`);
}

function defaultIsVersionMetaOnlyPath(filePath, skillPrefix) {
  const norm = String(filePath || '').replace(/\\/g, '/');
  if (!defaultIsSkillRepoPath(norm, skillPrefix)) return false;
  const rel = skillPrefix && norm.startsWith(`${skillPrefix}/`)
    ? norm.slice(skillPrefix.length + 1)
    : norm;
  return DEFAULT_VERSION_META.has(rel);
}

function readVersionFile(versionFile) {
  if (!fs.existsSync(versionFile)) return '0.0.0';
  const raw = fs.readFileSync(versionFile, 'utf8').trim();
  return raw || '0.0.0';
}

function bumpSemver(version, level = 'patch') {
  const m = String(version || '0.0.0').trim().match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!m) throw new Error(`VERSION 不是 semver 格式: ${version}`);
  let major = Number(m[1]);
  let minor = Number(m[2]);
  let patch = Number(m[3]);
  if (level === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (level === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

function changelogEntry(to, subject, body) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`## ${to} - ${date}`, '', `- ${subject || 'Update skill'}`];
  const bodyLines = [];
  for (const rawLine of String(body || '').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^(Recent commits|Diff excerpt):$/i.test(line)) break;
    bodyLines.push(line);
    if (bodyLines.length >= 6) break;
  }
  for (const line of bodyLines) {
    if (line.startsWith('- ')) lines.push(line);
    else lines.push(`- ${line.replace(/^[-*]\s+/, '')}`);
  }
  return `${lines.join('\n')}\n`;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function recordGenericVersionBump(ctx, repoRoot, commitMsg, level) {
  const existedVersion = fs.existsSync(ctx.versionFile);
  const existedChangelog = fs.existsSync(ctx.changelogFile);
  const from = existedVersion ? readVersionFile(ctx.versionFile) : null;
  const to = existedVersion ? bumpSemver(from, level) : INITIAL_VERSION;
  ensureParentDir(ctx.versionFile);
  fs.writeFileSync(ctx.versionFile, `${to}\n`);

  const existing = existedChangelog
    ? fs.readFileSync(ctx.changelogFile, 'utf8').trimStart()
    : '# Changelog\n\n';
  const normalized = existing.startsWith('# Changelog') ? existing : `# Changelog\n\n${existing}`;
  const prior = normalized.replace(/^# Changelog\s*/i, '').trim();
  const next = `# Changelog\n\n${changelogEntry(to, commitMsg.subject, commitMsg.body)}${prior ? `\n${prior}\n` : ''}`;
  fs.writeFileSync(ctx.changelogFile, next);

  const gitPaths = [ctx.versionFile, ctx.changelogFile]
    .map((p) => path.relative(repoRoot, p).replace(/\\/g, '/'));
  return {
    from: from || '(none)',
    to,
    gitPaths,
    skillPrefix: ctx.label,
    created: !existedVersion || !existedChangelog,
    createdVersion: !existedVersion,
    createdChangelog: !existedChangelog,
  };
}

/**
 * 检测当前 git 仓库是否具备 commit-push 升版能力。
 * 优先使用 pipeline-version.cjs；否则对含 SKILL.md + VERSION 的 skill 目录使用内置 fallback。
 */
function loadPipelineVersionCapability(repoRoot, snapshot = null) {
  const modPath = findPipelineVersionModulePath(repoRoot);
  if (modPath) {
    const versionCtx = resolveVersionContext(repoRoot, modPath);
    if (versionCtx) {
      let mod;
      try {
        mod = require(modPath);
      } catch (e) {
        console.warn(`警告: 无法加载 ${modPath}: ${e.message}`);
        return null;
      }

      if (
        typeof mod.readPipelineVersion === 'function' ||
        typeof mod.bumpVersion === 'function' ||
        typeof mod.recordCommitPushVersionBump === 'function'
      ) {
        if (
          typeof mod.readPipelineVersion === 'function' &&
          typeof mod.bumpVersion === 'function' &&
          typeof mod.recordCommitPushVersionBump === 'function'
        ) {
          return {
            type: 'pipeline',
            mod,
            modPath,
            versionFile: versionCtx.versionFile,
            skillPrefix: versionCtx.skillPrefix,
            adapter: createPathAdapter(mod),
          };
        }
        return null;
      }
    }
  }

  const genericCtx = resolveGenericSkillVersionContext(repoRoot, snapshot);
  if (!genericCtx) return null;
  const mod = {
    readPipelineVersion: () => readVersionFile(genericCtx.versionFile),
    bumpVersion: bumpSemver,
    recordCommitPushVersionBump: ({ skillsRoot, subject, body, level }) =>
      recordGenericVersionBump(genericCtx, skillsRoot, { subject, body }, level),
  };
  return {
    type: 'skill',
    mod,
    modPath: null,
    versionFile: genericCtx.versionFile,
    skillPrefix: genericCtx.skillPrefix,
    adapter: createPathAdapter(mod),
  };
}

/** @deprecated 兼容旧导出名 */
function loadPipelineVersionModule(repoRoot) {
  const cap = loadPipelineVersionCapability(repoRoot);
  if (!cap) return null;
  return { mod: cap.mod, modPath: cap.modPath };
}

/** 是否应对本次提交做自动升版（仅当仓库具备升版能力且有实质变更） */
function shouldBumpVersion(snapshot, capability) {
  if (!capability) return false;
  const { adapter, skillPrefix } = capability;
  const paths = snapshot.nameStatus.map((x) => x.path);
  const skillChanges = paths.filter((p) => adapter.isSkillRepoPath(p, skillPrefix));
  if (skillChanges.length === 0) return false;
  const substantive = skillChanges.filter((p) => !adapter.isVersionMetaOnlyPath(p, skillPrefix));
  return substantive.length > 0;
}

/** @deprecated */
const shouldBumpStd4SkillVersion = shouldBumpVersion;

function bumpVersionForCommit(repoRoot, snapshot, commitMsg, dryRun) {
  const capability = loadPipelineVersionCapability(repoRoot, snapshot);
  if (!capability || !shouldBumpVersion(snapshot, capability)) return null;

  const { mod, skillPrefix } = capability;
  const from = mod.readPipelineVersion(repoRoot);
  const to = mod.bumpVersion(from, 'patch');
  const label = skillPrefix || path.basename(repoRoot);

  if (dryRun) {
    return { from, to, dryRun: true, skillPrefix: label };
  }

  const bump = mod.recordCommitPushVersionBump({
    skillsRoot: repoRoot,
    subject: commitMsg.subject,
    body: commitMsg.body || '',
    level: 'patch',
  });
  console.log(
    `\n${label} 版本: ${bump.from} → ${bump.to}（已写入 VERSION / CHANGELOG${capability.type === 'pipeline' ? ' / package.json / manifest' : ''}）`
  );
  return { ...bump, skillPrefix: label };
}

/** @deprecated */
const bumpStd4SkillForCommit = bumpVersionForCommit;

function isContextVersionMetaOnly(filePath, ctx) {
  return defaultIsVersionMetaOnlyPath(filePath, ctx.skillPrefix);
}

function contextHasSubstantiveChanges(snapshot, ctx) {
  const paths = snapshot.nameStatus.map((x) => x.path);
  const changes = paths.filter((p) => defaultIsSkillRepoPath(p, ctx.skillPrefix));
  if (changes.length === 0) return false;
  return changes.some((p) => !isContextVersionMetaOnly(p, ctx));
}

function planVersionMaintenance(repoRoot, snapshot) {
  const contexts = discoverVersionableContexts(repoRoot, snapshot);
  return contexts.filter((ctx) => {
    if (!ctx.skillPrefix) return true;
    return contextHasSubstantiveChanges(snapshot, ctx);
  });
}

function previewVersionMaintenance(repoRoot, snapshot) {
  return planVersionMaintenance(repoRoot, snapshot).map((ctx) => {
    const exists = fs.existsSync(ctx.versionFile);
    const from = exists ? readVersionFile(ctx.versionFile) : '(none)';
    return {
      from,
      to: exists ? bumpSemver(from, 'patch') : INITIAL_VERSION,
      dryRun: true,
      skillPrefix: ctx.label,
      type: ctx.type,
      created: !exists || !fs.existsSync(ctx.changelogFile),
      createdVersion: !exists,
      createdChangelog: !fs.existsSync(ctx.changelogFile),
      gitPaths: [ctx.versionFile, ctx.changelogFile].map((p) => path.relative(repoRoot, p).replace(/\\/g, '/')),
    };
  });
}

function maintainVersionsForCommit(repoRoot, snapshot, commitMsg, dryRun) {
  const contexts = planVersionMaintenance(repoRoot, snapshot);
  if (dryRun) return previewVersionMaintenance(repoRoot, snapshot);

  const bumps = [];
  for (const ctx of contexts) {
    const bump = recordGenericVersionBump(ctx, repoRoot, commitMsg, 'patch');
    bumps.push({ ...bump, type: ctx.type });
    console.log(
      `\n${ctx.label} 版本: ${bump.from} → ${bump.to}（已写入 VERSION / CHANGELOG${bump.created ? '，含缺失文件初始化' : ''}）`
    );
  }
  return bumps;
}

function primaryVersionBump(versionBumps) {
  if (!versionBumps || !versionBumps.length) return null;
  return versionBumps[versionBumps.length - 1];
}

function printHumanReport(report, opts = {}) {
  if (opts.multi) {
    console.log(`\n--- 仓库: ${report.repoRoot} ---`);
  } else {
    console.log('\n=== commit_push 分析报告 ===\n');
  }
  console.log(`仓库: ${report.repoRoot}`);
  if (report.scopePaths && report.scopePaths.length) {
    console.log(`范围文件: ${report.scopePaths.join(', ')}`);
  }
  console.log(`分支: ${report.branch}${report.upstream ? ` (跟踪 ${report.upstream})` : ''}`);
  if (report.unpushedCount > 0) {
    console.log(`未推送提交: ${report.unpushedCount} 个（已提交但尚未 push）`);
  }
  if (report.pushProxy) console.log(`推送代理: ${report.pushProxy}`);
  else console.log('推送代理: (未使用，--no-proxy)');
  console.log(`变更文件: ${report.analysis.total}`);
  if (report.analysis.blockedInPorcelain.length) {
    console.log(`已忽略疑似密钥路径: ${report.analysis.blockedInPorcelain.join(', ')}`);
  }
  if (report.analysis.primaryDirs.length) {
    console.log(`主要目录: ${report.analysis.primaryDirs.join(', ')}`);
  }
  if (report.analysis.hints.length) {
    console.log(`启发式标签: ${report.analysis.hints.join(', ')}`);
  }
  if (report.snapshot.diffStat) {
    console.log('\n--- git diff --stat ---\n');
    console.log(report.snapshot.diffStat || '(无)');
  }
  console.log('\n--- 建议提交说明 ---\n');
  console.log(`Subject: ${report.commit.subject}`);
  if (report.commit.body) console.log(`\n${report.commit.body}`);
  if (report.versionBumps && report.versionBumps.length) {
    console.log('\n版本维护:');
    for (const b of report.versionBumps) {
      const who = b.skillPrefix || '项目';
      const action = b.created ? '初始化/升版' : '升版';
      if (b.dryRun) console.log(`  - ${who}: ${action} ${b.from} → ${b.to}（正式执行时写入 VERSION / CHANGELOG）`);
      else console.log(`  - ${who}: ${action} ${b.from} → ${b.to}`);
    }
  } else if (report.versionCapability) {
    console.log('\n版本维护: 未触发（无实质变更或仅版本元数据文件变更）');
  } else {
    console.log('\n版本维护: 跳过（未发现需要维护的项目或子项目）');
  }
  if (report.remoteStatus) {
    const rs = report.remoteStatus;
    if (rs.state === 'ok') {
      console.log(`\n远端: 可用 (${rs.fullName || rs.url || rs.remote})`);
    } else if (rs.needsCreate) {
      const vis = githubRemote.visibilityLabel({ githubVisibility: report.githubVisibility || 'private' });
      console.log(`\n远端: 不可用 (${rs.state}) — 推送前可 gh 建仓 (${vis}: ${rs.fullName || rs.repoName})`);
      console.log('  用户同意后加 --create-remote --yes');
    } else {
      console.log(`\n远端: ${rs.state}${rs.detail ? ` — ${rs.detail}` : ''}`);
    }
  }
  console.log('\n说明: 对话里 Agent 的「修改目的」来自聊天上下文；本脚本用 --intent 对齐该输入。');
}

function buildRepoReport(target, opts, pushProxy) {
  const repoRoot = target.repoRoot;
  const scopePaths = target.scopePaths || [];
  const multiRepo = Boolean(opts.multiRepo);
  const repoOpts = {
    ...opts,
    cwd: repoRoot,
    scopePaths,
    githubRepo: multiRepo ? null : opts.githubRepo,
  };

  const rawSnapshot = collectGitSnapshot(repoRoot);
  const snapshot = applyScopeToSnapshot(rawSnapshot, scopePaths);
  const analysis = analyzeChanges(snapshot);
  const commitMsg = buildCommitMessage(snapshot, analysis, repoOpts);

  const versionBumpPreview = previewVersionMaintenance(repoRoot, snapshot);
  const versionCapability = versionBumpPreview.length
    ? { modPath: null, skillPrefix: versionBumpPreview.map((b) => b.skillPrefix).join(', ') }
    : null;

  const remoteStatus = opts.noPush
    ? null
    : githubRemote.assessRemoteStatus(repoRoot, {
        remote: opts.remote,
        githubOwner: opts.githubOwner,
        githubRepo: repoOpts.githubRepo,
        env: pushEnv(pushProxy),
      });

  return {
    repoRoot,
    scopePaths,
    branch: snapshot.branch,
    upstream: snapshot.upstream,
    pushProxy: pushProxy || null,
    githubVisibility: opts.githubVisibility,
    remoteStatus,
    versionCapability,
    versionBumps: versionBumpPreview,
    versionBump: primaryVersionBump(versionBumpPreview),
    std4VersionBump: primaryVersionBump(versionBumpPreview),
    hasChanges: snapshot.hasChanges || analysis.total > 0,
    hasPendingPush: snapshot.hasPendingPush,
    unpushedCount: snapshot.unpushedCount,
    snapshot: {
      statusPorcelain: snapshot.statusPorcelain,
      diffStat: snapshot.diffStat,
      diffCachedStat: snapshot.diffCachedStat,
      nameStatus: snapshot.nameStatus,
      logRecent: snapshot.logRecent,
    },
    analysis,
    commit: commitMsg,
    _runtime: { snapshot, repoOpts },
  };
}

function runRepoCommitPush(report, opts) {
  const repoRoot = report.repoRoot;
  const { snapshot, repoOpts } = report._runtime;
  const commitMsg = report.commit;
  const pushProxy = resolvePushProxy(opts);

  // ── 仅推送模式：无工作区变更但有未推送的本地提交 ────────────────
  if (!report.hasChanges && report.hasPendingPush) {
    const op = makeOperationResult(report, opts);
    const actions = [];

    if (opts.dryRun) {
      const n = report.unpushedCount;
      console.log(`[dry-run] 无工作区变更，但有 ${n} 个未推送的本地提交，将直接推送。`);
      actions.push(`git push -u ${opts.remote}/${snapshot.branch}（${n} 个未推送提交）`);
      op.actions = actions;
      op.pendingPushOnly = true;
      return Promise.resolve(op);
    }

    if (opts.noPush) {
      console.log(`[${path.basename(repoRoot)}] 有 ${report.unpushedCount} 个本地提交未推送，但 --no-push 已设置，跳过。`);
      op.actions = actions;
      op.pendingPushOnly = true;
      return Promise.resolve(op);
    }

    const pushProxyResolved = resolvePushProxy(opts);
    if (pushProxyResolved) {
      applyProxy(pushProxyResolved);
      console.log(`\n[${path.basename(repoRoot)}] 推送前已设置代理: ${pushProxyResolved}`);
    }
    console.log(`\n[${path.basename(repoRoot)}] 无工作区变更，但有 ${report.unpushedCount} 个未推送提交，直接推送...`);

    return new Promise((resolve) => {
      ensureRemoteBeforePush(repoRoot, repoOpts, pushProxyResolved, (err, remoteResult) => {
        if (err) {
          op.ok = false;
          op.error = err.message;
          op.actions = actions;
          resolve(op);
          return;
        }
        if (remoteResult && remoteResult.created !== undefined && remoteResult.fullName) {
          op.remoteCreated = {
            fullName: remoteResult.fullName,
            created: Boolean(remoteResult.created),
            visibility: githubRemote.visibilityLabel(opts),
            url: remoteResult.remote_url || remoteResult.url || null,
          };
          if (op.remoteCreated.created) {
            actions.push(`gh repo create ${op.remoteCreated.fullName}（${op.remoteCreated.visibility}）`);
          }
        }
        syncWithRemote(repoRoot, opts.remote, opts.branch, pushProxyResolved);
        actions.push(`git fetch ${opts.remote}`);
        const p = push(repoRoot, opts.remote, opts.branch, false, pushEnv(pushProxyResolved));
        if (!p.ok) {
          console.error(`[${path.basename(repoRoot)}] git push 失败:`, p.error || '');
          op.ok = false;
          op.error = p.error || 'push failed';
          op.actions = actions;
          resolve(op);
          return;
        }
        op.pushed = true;
        op.pendingPushOnly = true;
        actions.push(`git push -u ${opts.remote}/${snapshot.branch}（${report.unpushedCount} 个未推送提交）`);
        op.actions = actions;
        console.log(`\n[${path.basename(repoRoot)}] 推送完成。`);
        git(repoRoot, ['status'], { inherit: true });
        resolve(op);
      });
    });
  }

  const versionBumps = maintainVersionsForCommit(repoRoot, snapshot, commitMsg, opts.dryRun);
  if (versionBumps.length) {
    report.versionBumps = versionBumps;
    report.versionBump = primaryVersionBump(versionBumps);
    report.std4VersionBump = report.versionBump;
  }

  const stagedPreview = report.analysis.byCode.A.concat(
    report.analysis.byCode.M,
    report.analysis.byCode.R,
    report.analysis.byCode.other
  );

  if (opts.dryRun) {
    console.log('\n[dry-run] git add …');
    for (const bump of versionBumps) {
      const who = bump.skillPrefix || '项目';
      const action = bump.created ? '初始化/升版' : '升版';
      console.log(`[dry-run] ${who} ${action} ${bump.from} → ${bump.to}，写入 VERSION / CHANGELOG.md`);
    }
    console.log(`[dry-run] git commit -m "${commitMsg.subject}"`);
    let wouldCreateRemote = false;
    let remoteFullName = null;
    if (!opts.noPush) {
      if (pushProxy) console.log(`[dry-run] 推送代理: ${pushProxy}`);
      const rs = githubRemote.assessRemoteStatus(repoRoot, {
        remote: opts.remote,
        githubOwner: opts.githubOwner,
        githubRepo: repoOpts.githubRepo,
        env: pushEnv(pushProxy),
      });
      if (rs.needsCreate) {
        githubRemote.printRemoteProvisionPreview(rs, opts);
        wouldCreateRemote = true;
        remoteFullName = rs.fullName;
      }
      console.log(`[dry-run] git fetch ${opts.remote}  # 检查远端是否有新提交`);
      console.log(`[dry-run] (如远端领先则执行 git pull --no-rebase ${opts.remote} ${snapshot.branch})`);
      console.log(`[dry-run] git push -u ${opts.remote} ${snapshot.branch}`);
    }
    const op = makeOperationResult(report, opts, {
      ok: true,
      filesStaged: stagedPreview,
      stagedMode: repoOpts.scopePaths.length ? 'scope' : 'all',
      actions: buildPlannedActions(report, opts, {
        stagedFiles: stagedPreview.length ? stagedPreview : ['-A'],
        wouldCreateRemote,
        remoteFullName,
      }),
      pushed: false,
    });
    return Promise.resolve(op);
  }

  if (versionBumps.length && !versionBumps[0].dryRun) {
    report.versionBumps = versionBumps.map((b) => ({
      from: b.from,
      to: b.to,
      skillPrefix: b.skillPrefix,
      created: b.created,
      type: b.type,
      gitPaths: b.gitPaths,
    }));
    report.versionBump = primaryVersionBump(report.versionBumps);
    report.std4VersionBump = report.versionBump;
  }

  const op = makeOperationResult(report, opts);
  const actions = [];

  const staged = stageFiles(repoRoot, report.analysis, { ...repoOpts, addAll: !repoOpts.scopePaths.length });
  if (!staged.ok) {
    console.error(`[${repoRoot}] git add 失败:`, staged.error);
    op.ok = false;
    op.error = staged.error;
    return Promise.resolve(op);
  }
  op.filesStaged = staged.files.filter((f) => f !== '-A');
  op.stagedMode = staged.mode;
  actions.push(staged.files[0] === '-A' ? 'git add -A' : `git add（${staged.files.length} 个文件）`);

  const versionGitPaths = versionBumps
    .filter((b) => !b.dryRun && Array.isArray(b.gitPaths))
    .flatMap((b) => b.gitPaths);
  if (versionGitPaths.length) {
    for (const p of [...new Set(versionGitPaths)]) {
      const ar = git(repoRoot, ['add', '--', p]);
      if (!ar.ok) {
        console.error(`[${repoRoot}] git add 版本文件失败:`, p, ar.stderr);
        op.ok = false;
        op.error = ar.stderr;
        return Promise.resolve(op);
      }
      if (!op.filesStaged.includes(p)) op.filesStaged.push(p);
    }
    for (const bump of versionBumps) {
      const action = bump.created ? '初始化/升版' : '升版';
      actions.push(`${bump.skillPrefix || '项目'} ${action} ${bump.from} → ${bump.to}`);
    }
  }

  const c = commit(repoRoot, commitMsg.subject, commitMsg.body, false);
  if (!c.ok) {
    console.error(`[${path.basename(repoRoot)}] git commit 失败`);
    op.ok = false;
    op.error = 'commit failed';
    return Promise.resolve(op);
  }
  op.committed = true;
  op.commitHash = git(repoRoot, ['rev-parse', '--short', 'HEAD']).stdout || null;
  actions.push(`git commit → ${op.commitHash || '(ok)'}`);

  if (repoOpts.scopePaths.length) {
    op.extraDirtyFiles = checkExtraDirtyFiles(repoRoot, repoOpts.scopePaths);
    if (op.extraDirtyFiles.length) {
      console.warn(
        `\n[${path.basename(repoRoot)}] 注意：同仓库内还有 ${op.extraDirtyFiles.length} 个未提交文件（范围外，已跳过）。`
      );
    }
  }

  if (opts.noPush) {
    console.log(`\n[${path.basename(repoRoot)}] 提交完成（未推送，--no-push）。`);
    git(repoRoot, ['status'], { inherit: true });
    op.actions = actions;
    return Promise.resolve(op);
  }

  const pushProxyResolved = resolvePushProxy(opts);
  if (pushProxyResolved) {
    applyProxy(pushProxyResolved);
    console.log(`\n[${path.basename(repoRoot)}] 推送前已设置代理: ${pushProxyResolved}`);
  }

  return new Promise((resolve) => {
    ensureRemoteBeforePush(repoRoot, repoOpts, pushProxyResolved, (err, remoteResult) => {
      if (err) {
        op.ok = false;
        op.error = err.message;
        op.actions = actions;
        resolve(op);
        return;
      }

      if (remoteResult && remoteResult.created !== undefined && remoteResult.fullName) {
        op.remoteCreated = {
          fullName: remoteResult.fullName,
          created: Boolean(remoteResult.created),
          visibility: githubRemote.visibilityLabel(opts),
          url: remoteResult.remote_url || remoteResult.url || null,
        };
        if (op.remoteCreated.created) {
          actions.push(`gh repo create ${op.remoteCreated.fullName}（${op.remoteCreated.visibility}）`);
        }
      }

      syncWithRemote(repoRoot, opts.remote, opts.branch, pushProxyResolved);
      actions.push(`git fetch ${opts.remote}`);

      const p = push(repoRoot, opts.remote, opts.branch, false, pushEnv(pushProxyResolved));
      if (!p.ok) {
        console.error(`[${path.basename(repoRoot)}] git push 失败:`, p.error || '');
        op.ok = false;
        op.error = p.error || 'push failed';
        op.actions = actions;
        resolve(op);
        return;
      }
      op.pushed = true;
      actions.push(`git push -u ${opts.remote}/${op.branch}`);
      op.actions = actions;
      console.log(`\n[${path.basename(repoRoot)}] 推送完成。`);
      git(repoRoot, ['status'], { inherit: true });
      resolve(op);
    });
  });
}

function stripRuntime(report) {
  const { _runtime, ...rest } = report;
  return rest;
}

function buildPlannedActions(report, opts, extras = {}) {
  const actions = [];
  const staged = extras.stagedFiles || [];
  if (staged.length) {
    actions.push(staged[0] === '-A' ? 'git add -A' : `git add（${staged.length} 个文件）`);
  }
  if (report.versionBumps && report.versionBumps.length) {
    for (const bump of report.versionBumps) {
      const action = bump.created ? '初始化/升版' : '升版';
      actions.push(`${bump.skillPrefix || '项目'} ${action} ${bump.from} → ${bump.to}`);
    }
  }
  actions.push(`git commit -m "${report.commit.subject}"`);
  if (!opts.noPush) {
    if (extras.wouldCreateRemote) {
      actions.push(`gh repo create（${extras.remoteFullName || '?'}，${githubRemote.visibilityLabel(opts)}）`);
    }
    actions.push(`git fetch ${opts.remote}`);
    actions.push(`git push -u ${opts.remote} ${report.branch}`);
  }
  return actions;
}

function makeOperationResult(report, opts, base = {}) {
  return {
    ok: base.ok !== false,
    repoRoot: report.repoRoot,
    repoLabel: path.basename(report.repoRoot),
    branch: report.branch,
    scopePaths: report.scopePaths || [],
    dryRun: Boolean(opts.dryRun),
    committed: false,
    commitHash: null,
    commitSubject: report.commit.subject,
    filesStaged: [],
    stagedMode: null,
    versionBumps: report.versionBumps
      ? report.versionBumps.map((b) => ({
          from: b.from,
          to: b.to,
          skillPrefix: b.skillPrefix,
          created: b.created,
          type: b.type,
        }))
      : [],
    versionBump: report.versionBump
      ? {
          from: report.versionBump.from,
          to: report.versionBump.to,
          skillPrefix: report.versionBump.skillPrefix,
          created: report.versionBump.created,
          type: report.versionBump.type,
        }
      : null,
    remoteCreated: null,
    pushed: false,
    pushRemote: opts.remote,
    actions: [],
    extraDirtyFiles: [],
    error: base.error || null,
    ...base,
  };
}

/** 检查仓库内 scope 以外的其他未提交文件（仅在 scoped 提交后调用） */
function checkExtraDirtyFiles(repoRoot, scopePaths) {
  if (!scopePaths.length) return [];
  const r = gitLines(repoRoot, ['status', '--porcelain']);
  if (!r.ok) return [];
  return r.lines
    .map((l) => {
      let p = l.slice(3).trim();
      if (p.includes(' -> ')) p = p.split(' -> ').pop().trim();
      return p;
    })
    .filter((p) => p && !isBlockedPath(p) && !pathMatchesScope(p, scopePaths));
}

function printOperationReport({ results, reports, skipped, opts }) {
  const lines = [];
  const divider = '═'.repeat(56);

  lines.push('');
  lines.push(divider);
  lines.push(opts.dryRun ? '  commit_push 操作报告（预览，未写入 git）' : '  commit_push 操作报告');
  lines.push(divider);

  if (skipped && skipped.length) {
    lines.push('');
    lines.push('⏭  已跳过路径');
    for (const s of skipped) {
      lines.push(`   • ${s.path}  (${s.reason})`);
    }
  }

  const noChange = reports.filter((r) => !r.hasChanges);
  if (noChange.length) {
    lines.push('');
    lines.push('⏭  无变更（未提交）');
    for (const r of noChange) {
      lines.push(`   • ${r.repoRoot}${r.scopePaths.length ? ` ← ${r.scopePaths.join(', ')}` : ''}`);
    }
  }

  if (!results.length) {
    lines.push('');
    lines.push('未执行任何 git 操作。');
    lines.push(divider);
    console.log(lines.join('\n'));
    return;
  }

  for (const op of results) {
    lines.push('');
    lines.push(`📦 ${op.repoLabel}  (${op.repoRoot})`);
    lines.push(`   分支: ${op.branch}${op.scopePaths.length ? `  |  范围: ${op.scopePaths.join(', ')}` : ''}`);

    if (!op.ok) {
      lines.push(`   ❌ 失败: ${op.error || '未知错误'}`);
      continue;
    }

    if (op.dryRun) {
      lines.push('   模式: 预览（dry-run）');
    }

    for (const action of op.actions) {
      lines.push(`   ✓ ${action}`);
    }

    if (op.filesStaged.length) {
      const preview = op.filesStaged.slice(0, 8);
      const more = op.filesStaged.length > 8 ? ` …等 ${op.filesStaged.length} 个` : '';
      lines.push(`   暂存: ${preview.join(', ')}${more}`);
    }

    if (op.versionBumps && op.versionBumps.length && !op.dryRun) {
      for (const bump of op.versionBumps) {
        const action = bump.created ? '初始化/升版' : '升版';
        lines.push(`   ${action}: ${bump.skillPrefix || '项目'} ${bump.from} → ${bump.to}`);
      }
    }

    if (op.pendingPushOnly) {
      lines.push(`   模式: 仅推送（无工作区变更，直接推送本地提交）`);
    } else if (op.committed && op.commitHash) {
      lines.push(`   提交: ${op.commitHash}  "${op.commitSubject}"`);
    } else if (op.dryRun && op.commitSubject) {
      lines.push(`   将提交: "${op.commitSubject}"`);
    }

    if (op.remoteCreated) {
      const rc = op.remoteCreated;
      lines.push(
        `   远端: ${rc.created ? '新建' : '复用'} ${rc.fullName}（${rc.visibility}）${rc.url ? ` → ${rc.url}` : ''}`
      );
    }

    if (op.extraDirtyFiles && op.extraDirtyFiles.length) {
      const preview = op.extraDirtyFiles.slice(0, 5).join(', ');
      const more = op.extraDirtyFiles.length > 5 ? ` …共 ${op.extraDirtyFiles.length} 个` : '';
      lines.push(`   ⚠  同仓库内还有未提交文件（范围外）: ${preview}${more}`);
    }

    if (opts.noPush) {
      lines.push('   推送: 跳过（--no-push）');
    } else if (op.dryRun) {
      lines.push(`   推送: 将推送到 ${op.pushRemote}/${op.branch}`);
    } else if (op.pushed) {
      lines.push(`   推送: 已推送到 ${op.pushRemote}/${op.branch}`);
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;
  lines.push('');
  lines.push(divider);
  if (opts.dryRun) {
    lines.push(`  预览完成：${results.length} 个仓库  |  正式执行请加 --yes`);
  } else if (failCount) {
    lines.push(`  完成：成功 ${okCount}，失败 ${failCount}`);
  } else {
    lines.push(`  全部完成：${okCount} 个仓库已处理`);
  }
  lines.push(divider);
  console.log(lines.join('\n'));
}

// ── main ──────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { targets, skipped } = resolveRepoTargets(opts);

  if (targets.length === 0) {
    console.error('错误: 未找到有效的 git 仓库');
    if (skipped.length) {
      for (const s of skipped) console.error(`  跳过 ${s.path}: ${s.reason}`);
    }
    process.exit(1);
  }

  const multiRepo = targets.length > 1;
  opts.multiRepo = multiRepo;
  const pushProxy = resolvePushProxy(opts);

  if (skipped.length) {
    console.warn('\n以下路径已跳过:');
    for (const s of skipped) console.warn(`  ${s.path} (${s.reason})`);
  }

  if (multiRepo) {
    console.log(`\n检测到 ${targets.length} 个 git 仓库，将分别提交推送:`);
    for (const t of targets) {
      console.log(`  • ${t.repoRoot}${t.scopePaths.length ? ` ← ${t.scopePaths.join(', ')}` : ''}`);
    }
  }

  const reports = targets.map((t) => buildRepoReport(t, opts, pushProxy));

  if (opts.jsonReport) {
    console.log(JSON.stringify({ repos: reports.map(stripRuntime), skipped }, null, 2));
    return;
  }

  if (multiRepo) {
    console.log('\n=== commit_push 多仓库分析报告 ===');
  }
  for (const report of reports) {
    printHumanReport(report, { multi: multiRepo });
  }

  // 有工作区变更 OR 有尚未推送到远端的提交，均视为可操作
  const actionable = reports.filter((r) => r.hasChanges || r.hasPendingPush);
  if (actionable.length === 0) {
    printOperationReport({ results: [], reports, skipped, opts });
    process.exit(0);
  }

  const runAll = async () => {
    const results = [];
    for (const report of actionable) {
      if (multiRepo) {
        console.log(`\n========== 执行: ${report.repoRoot} ==========`);
      }
      const result = await runRepoCommitPush(report, opts);
      results.push(result);
    }
    printOperationReport({ results, reports, skipped, opts });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      process.exit(1);
    }
  };

  if (!opts.yes && !opts.dryRun) {
    const repos = actionable.map((r) => path.basename(r.repoRoot)).join(', ');
    console.log(`\n将执行 (${repos}): 版本维护 → git add → git commit →` + (opts.noPush ? ' (不推送)' : ' git push'));
    console.log('加 --yes 跳过确认，或 --dry-run 仅预览。\n');
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('继续? [y/N] ', (ans) => {
      rl.close();
      if (!/^y(es)?$/i.test(String(ans).trim())) {
        console.log('已取消。');
        process.exit(0);
      }
      runAll();
    });
    return;
  }

  runAll();
}

if (require.main === module) {
  main();
}

module.exports = {
  collectGitSnapshot,
  analyzeChanges,
  buildCommitMessage,
  isBlockedPath,
  findGitRoot,
  pathMatchesScope,
  resolveRepoTargets,
  applyScopeToSnapshot,
  buildRepoReport,
  runRepoCommitPush,
  printOperationReport,
  makeOperationResult,
  findPipelineVersionModulePath,
  loadPipelineVersionCapability,
  loadPipelineVersionModule,
  shouldBumpVersion,
  bumpVersionForCommit,
  shouldBumpStd4SkillVersion,
  bumpStd4SkillForCommit,
  discoverVersionableContexts,
  planVersionMaintenance,
  previewVersionMaintenance,
  maintainVersionsForCommit,
  ensureRemoteBeforePush,
  ...githubRemote,
};
