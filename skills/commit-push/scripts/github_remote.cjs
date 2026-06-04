'use strict';

/**
 * GitHub 远端检测与可选自动建仓（供 commit_push.cjs 使用，不依赖业务项目代码）。
 */

const { spawnSync } = require('child_process');
const path = require('path');

function slugifyRepoName(name) {
  return String(name || 'project')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'project';
}

function gh(args, opts = {}) {
  return spawnSync('gh', args, {
    encoding: 'utf8',
    cwd: opts.cwd,
    env: opts.env || process.env,
    timeout: opts.timeout || 120_000,
  });
}

function git(repoRoot, args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    cwd: repoRoot,
  });
}

function ghAvailable() {
  return gh(['--version']).status === 0;
}

function ghAuthOk() {
  return gh(['auth', 'status']).status === 0;
}

function getGhViewerLogin(env) {
  const r = gh(['api', 'user', '-q', '.login'], { env });
  if (r.status !== 0) return null;
  const login = String(r.stdout || '').trim();
  return login || null;
}

function gitRemoteNames(repoRoot) {
  const r = git(repoRoot, ['remote']);
  if (r.status !== 0) return [];
  return String(r.stdout || '').split(/\s+/).filter(Boolean);
}

function getGitRemoteUrl(repoRoot, remoteName = 'origin') {
  const r = git(repoRoot, ['remote', 'get-url', remoteName]);
  if (r.status !== 0) return null;
  return String(r.stdout || '').trim() || null;
}

function normalizeRemoteUrl(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  if (u.endsWith('.git')) return u;
  if (/^git@github\.com:/.test(u)) return u;
  if (/^https:\/\/github\.com\//.test(u)) return `${u}.git`;
  return u;
}

function parseGithubRemote(url) {
  const u = String(url || '').trim();
  let m = u.match(/^https:\/\/github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?\/?$/i);
  if (m) return { owner: m[1], repo: m[2], host: 'github.com' };
  m = u.match(/^git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/i);
  if (m) return { owner: m[1], repo: m[2], host: 'github.com' };
  return null;
}

function resolveRepoSpec(repoRoot, opts = {}) {
  const remote = opts.remote || 'origin';
  const existingUrl = getGitRemoteUrl(repoRoot, remote);
  const parsed = existingUrl ? parseGithubRemote(existingUrl) : null;

  const repoName = String(opts.githubRepo || '').trim()
    || (parsed && parsed.repo)
    || slugifyRepoName(path.basename(repoRoot));

  let owner = String(opts.githubOwner || '').trim() || (parsed && parsed.owner) || null;
  if (!owner) owner = getGhViewerLogin(opts.env);

  const fullName = owner ? `${owner}/${repoName}` : repoName;
  return { repoName, owner, fullName, existingUrl: existingUrl ? normalizeRemoteUrl(existingUrl) : null };
}

function viewGithubRepo(fullName, env) {
  const r = gh(['repo', 'view', fullName, '--json', 'url,name,owner'], { env });
  if (r.status !== 0) {
    return { ok: false, detail: String(r.stderr || r.stdout || '').trim() };
  }
  try {
    const data = JSON.parse(r.stdout || '{}');
    return {
      ok: true,
      url: normalizeRemoteUrl(data.url),
      fullName: data.owner && data.name ? `${data.owner.login}/${data.name}` : fullName,
    };
  } catch (_) {
    return { ok: false, detail: 'parse gh repo view json failed' };
  }
}

/**
 * 评估远端是否可用于 push。
 * @returns {{ state: string, remote: string, fullName?: string, owner?: string, repoName?: string, url?: string, detail?: string }}
 */
function assessRemoteStatus(repoRoot, opts = {}) {
  const remote = opts.remote || 'origin';
  const spec = resolveRepoSpec(repoRoot, opts);

  if (!gitRemoteNames(repoRoot).includes(remote)) {
    return {
      state: 'no_remote',
      remote,
      ...spec,
      needsCreate: true,
    };
  }

  const url = getGitRemoteUrl(repoRoot, remote);
  if (!url) {
    return { state: 'no_remote', remote, ...spec, needsCreate: true };
  }

  const parsed = parseGithubRemote(url);
  if (!parsed) {
    return {
      state: 'non_github',
      remote,
      url,
      ...spec,
      needsCreate: false,
    };
  }

  const fullName = `${parsed.owner}/${parsed.repo}`;
  if (!ghAvailable()) {
    return {
      state: 'gh_unavailable',
      remote,
      url,
      fullName,
      owner: parsed.owner,
      repoName: parsed.repo,
      needsCreate: true,
    };
  }
  if (!ghAuthOk()) {
    return {
      state: 'gh_not_authenticated',
      remote,
      url,
      fullName,
      owner: parsed.owner,
      repoName: parsed.repo,
      needsCreate: true,
    };
  }

  const viewed = viewGithubRepo(fullName, opts.env);
  if (viewed.ok) {
    return {
      state: 'ok',
      remote,
      url: viewed.url || normalizeRemoteUrl(url),
      fullName: viewed.fullName || fullName,
      owner: parsed.owner,
      repoName: parsed.repo,
      needsCreate: false,
    };
  }

  const detail = viewed.detail || '';
  if (/not found|404|Could not resolve|GraphQL.*Could not find/i.test(detail)) {
    return {
      state: 'repo_not_found',
      remote,
      url,
      fullName,
      owner: parsed.owner,
      repoName: parsed.repo,
      needsCreate: true,
      detail,
    };
  }

  return {
    state: 'gh_view_failed',
    remote,
    url,
    fullName,
    owner: parsed.owner,
    repoName: parsed.repo,
    needsCreate: false,
    detail,
  };
}

function visibilityLabel(opts) {
  return opts.githubVisibility === 'public' ? 'public' : 'private';
}

function printRemoteOptions(status, opts) {
  const vis = visibilityLabel(opts);
  const name = status.fullName || status.repoName || '(未解析)';

  console.log('\n=== 远端仓库不可用 ===\n');
  if (status.state === 'no_remote') {
    console.log(`当前 git 仓库未配置 remote "${status.remote}"。`);
  } else if (status.state === 'repo_not_found') {
    console.log(`remote "${status.remote}" 指向的 GitHub 仓库不存在：${status.fullName}`);
    if (status.url) console.log(`  URL: ${status.url}`);
  } else if (status.state === 'gh_unavailable') {
    console.log('未检测到 gh CLI，无法自动创建 GitHub 仓库。');
  } else if (status.state === 'gh_not_authenticated') {
    console.log('gh 未登录，无法自动创建 GitHub 仓库。');
  } else if (status.state === 'non_github') {
    console.log(`remote "${status.remote}" 非 GitHub 地址，本 skill 无法自动建仓。`);
    if (status.url) console.log(`  URL: ${status.url}`);
    return;
  } else if (status.state === 'gh_view_failed') {
    console.log(`无法确认 GitHub 仓库状态：${status.detail || status.state}`);
  }

  console.log('\n可选操作：');
  console.log(`  1) 自动建仓 — gh repo create ${name} --${vis} 并设置 remote "${status.remote}"，然后推送`);
  console.log('  2) 手动配置 — git remote add/set-url 后重新运行本脚本');
  console.log('  3) 仅提交 — 加 --no-push 跳过推送');
  console.log('\n非交互 / Agent：用户同意后加 --create-remote --yes');
  console.log(`  例: node .../commit_push.cjs --intent="..." --create-remote --yes`);
}

function printRemoteProvisionPreview(status, opts) {
  const vis = visibilityLabel(opts);
  const name = status.fullName || status.repoName;
  console.log(`\n[dry-run] 远端: ${status.state} → 若用户同意将执行 gh repo create ${name} --${vis}`);
}

/**
 * @returns {{ ok: boolean, created?: boolean, fullName?: string, remote_url?: string, detail?: string, reason?: string }}
 */
function createGithubRemote(repoRoot, opts = {}) {
  const remote = opts.remote || 'origin';
  const vis = visibilityLabel(opts);
  const visFlag = vis === 'public' ? '--public' : '--private';
  const spec = resolveRepoSpec(repoRoot, opts);

  if (!ghAvailable()) return { ok: false, reason: 'gh_unavailable' };
  if (!ghAuthOk()) return { ok: false, reason: 'gh_not_authenticated' };

  const args = [
    'repo', 'create', spec.fullName,
    visFlag,
    '--source', repoRoot,
    `--remote=${remote}`,
    '--push=false',
  ];

  const create = gh(args, { cwd: repoRoot, env: opts.env });
  const stderr = String(create.stderr || create.stdout || '').trim();

  if (create.status === 0) {
    const remoteUrl = getGitRemoteUrl(repoRoot, remote)
      || (viewGithubRepo(spec.fullName, opts.env).url);
    return {
      ok: true,
      created: true,
      fullName: spec.fullName,
      remote_url: remoteUrl ? normalizeRemoteUrl(remoteUrl) : null,
    };
  }

  if (/already exists|name already exists on/i.test(stderr)) {
    const viewed = viewGithubRepo(spec.fullName, opts.env);
    if (viewed.ok && viewed.url) {
      git(repoRoot, gitRemoteNames(repoRoot).includes(remote)
        ? ['remote', 'set-url', remote, viewed.url]
        : ['remote', 'add', remote, viewed.url]);
      return {
        ok: true,
        created: false,
        fullName: viewed.fullName || spec.fullName,
        remote_url: viewed.url,
      };
    }
    return { ok: false, reason: 'github_repo_exists_no_url', detail: stderr };
  }

  return { ok: false, reason: 'gh_repo_create_failed', detail: stderr };
}

function remoteBlockReason(status) {
  switch (status.state) {
    case 'gh_unavailable':
      return '未安装 gh CLI';
    case 'gh_not_authenticated':
      return 'gh 未登录（请 gh auth login）';
    case 'non_github':
      return 'remote 非 GitHub，无法自动建仓';
    case 'gh_view_failed':
      return status.detail || '无法确认远端仓库状态';
    default:
      return null;
  }
}

module.exports = {
  slugifyRepoName,
  ghAvailable,
  ghAuthOk,
  assessRemoteStatus,
  createGithubRemote,
  printRemoteOptions,
  printRemoteProvisionPreview,
  remoteBlockReason,
  getGitRemoteUrl,
  parseGithubRemote,
  resolveRepoSpec,
  visibilityLabel,
};
