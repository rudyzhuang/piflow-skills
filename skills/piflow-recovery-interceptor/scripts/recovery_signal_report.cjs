#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SIGNAL_PATTERNS = [
  { type: "stage_failed", pattern: /stage_failed|exited with code|state.?[:=].?(failed|blocked|stopped)/i },
  { type: "recovery_start", pattern: /recovery_start|pipeline-recovery|repair_target|deterministic_retry/i },
  { type: "agent_timeout", pattern: /timeout|timed out|hang|stalled|no fresh review output/i },
  { type: "permission_ask", pattern: /permission ask|action\.action=ask|action\.pattern=\*\.env\.\*/i },
  { type: "teardown", pattern: /pipeline_teardown_start|stop\.signal|teardown/i },
];

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") opts.json = true;
    else if (arg === "--cwd") opts.cwd = argv[++i] || opts.cwd;
    else if (arg.startsWith("--cwd=")) opts.cwd = arg.slice("--cwd=".length);
    else if (arg === "--file") opts.file = argv[++i];
    else if (arg.startsWith("--file=")) opts.file = arg.slice("--file=".length);
    else if (arg === "-h" || arg === "--help") opts.help = true;
  }
  return opts;
}

function usage() {
  return [
    "Usage: node scripts/recovery_signal_report.cjs [--cwd <project-dir>] [--file <stages.json>] [--json]",
    "",
    "Reads the PiFlow project state and reports whether recovery interception is likely needed.",
  ].join("\n");
}

function exists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function tail(filePath, maxLines = 80) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function parseTime(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function rel(projectDir, targetPath) {
  if (!targetPath) return undefined;
  const absolute = path.isAbsolute(targetPath) ? targetPath : path.join(projectDir, targetPath);
  return exists(absolute) ? path.relative(projectDir, absolute) : targetPath;
}

function effectiveCurrent(stagesJson) {
  const pipeline = stagesJson.pipeline || {};
  const runtimeSnapshot = pipeline.runtime_snapshot || {};
  const candidates = [
    stagesJson.current,
    stagesJson.current_effective,
    pipeline.current_effective,
    runtimeSnapshot.current_effective,
  ];
  for (const candidate of candidates) {
    if (isPlainObject(candidate) && Object.keys(candidate).length) {
      return candidate;
    }
  }
  return {};
}

function buildReport(projectDir, stagesFile, stagesJson) {
  const pipeline = stagesJson.pipeline || {};
  const current = effectiveCurrent(stagesJson);
  const pipelineDir = path.join(projectDir, ".pipeline");
  const latestRecovery = Array.isArray(pipeline.recovery_history)
    ? pipeline.recovery_history.slice().sort((a, b) => parseTime(b.at || b.updated_at) - parseTime(a.at || a.updated_at))[0]
    : null;
  const recoveryRunMatches = latestRecovery && latestRecovery.run_id && stagesJson.run_id
    ? latestRecovery.run_id === stagesJson.run_id
    : false;
  const recoveryFiles = exists(pipelineDir)
    ? fs.readdirSync(pipelineDir)
        .filter((name) => /^pipeline-recovery-.*\.json$/.test(name))
        .map((name) => path.join(pipelineDir, name))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];

  const evidence = [];
  const seen = new Set();

  const currentLogPaths = [current.log_paths && current.log_paths.stage, current.log_paths && current.log_paths.global]
    .filter(Boolean)
    .map((item) => (path.isAbsolute(item) ? item : path.join(projectDir, item)))
    .filter(exists);

  const evidenceFiles = currentLogPaths.concat(recoveryRunMatches ? recoveryFiles.slice(0, 4) : []);
  for (const filePath of evidenceFiles) {
    for (const line of tail(filePath)) {
      for (const signal of SIGNAL_PATTERNS) {
        if (signal.pattern.test(line)) {
          const key = `${signal.type}:${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            evidence.push({
              type: signal.type,
              file: path.relative(projectDir, filePath),
              line: line.trim(),
            });
          }
        }
      }
    }
  }

  const currentState = String(current.state || current.status || "");
  const failedLike = /fail|error|blocked|stopped/i.test(currentState);
  const recoveryLike = evidence.some((item) => item.type === "recovery_start") || recoveryRunMatches;
  const shouldIntercept = failedLike && recoveryLike;

  return {
    cwd: projectDir,
    file: stagesFile,
    current_stage: current.stage || stagesJson.current_stage || pipeline.current_stage || null,
    current_state: current.state || current.status || null,
    run_id: stagesJson.run_id || pipeline.run_id || null,
    should_intercept: shouldIntercept,
    signal_summary: {
      failed_like_state: failedLike,
      recovery_like_signal: recoveryLike,
      recovery_files_present: recoveryFiles.length,
    },
    latest_recovery_file: recoveryFiles[0] ? path.relative(projectDir, recoveryFiles[0]) : null,
    latest_recovery_history: latestRecovery || null,
    current_logs: {
      stage: rel(projectDir, current.log_paths && current.log_paths.stage),
      global: rel(projectDir, current.log_paths && current.log_paths.global),
    },
    evidence,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Recovery Signal Report",
    "",
    `- 项目目录：${report.cwd}`,
    `- stages.json：${report.file}`,
    `- 当前 stage：${report.current_stage || "未知"}`,
    `- 当前状态：${report.current_state || "未知"}`,
    `- should_intercept：${report.should_intercept ? "yes" : "no"}`,
  ];
  if (report.latest_recovery_file) lines.push(`- 最新 recovery 文件：${report.latest_recovery_file}`);
  if (report.evidence.length) {
    lines.push("", "## 证据");
    report.evidence.forEach((item) => {
      lines.push(`- [${item.type}] ${item.file}: ${item.line}`);
    });
  }
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  const projectDir = path.resolve(opts.cwd);
  const stagesFile = path.resolve(opts.file || path.join(projectDir, "output-stages", "stages.json"));
  if (!exists(stagesFile)) {
    if (opts.json) console.log(JSON.stringify({ missing: true, cwd: projectDir, file: stagesFile }, null, 2));
    else console.log(["项目未开始或非 PiFlow 项目。", `检查路径：${stagesFile}`].join("\n"));
    process.exitCode = 1;
    return;
  }

  let stagesJson;
  try {
    stagesJson = readJson(stagesFile);
  } catch (error) {
    if (opts.json) console.log(JSON.stringify({ parse_error: error.message, cwd: projectDir, file: stagesFile }, null, 2));
    else console.log(["无法解析 stages.json。", `检查路径：${stagesFile}`, `错误：${error.message}`].join("\n"));
    process.exitCode = 1;
    return;
  }

  const report = buildReport(projectDir, stagesFile, stagesJson);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else console.log(renderMarkdown(report));
}

main();
