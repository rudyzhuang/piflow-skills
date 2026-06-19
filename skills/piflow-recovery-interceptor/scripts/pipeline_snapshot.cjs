#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

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
    "Usage: node scripts/pipeline_snapshot.cjs [--cwd <project-dir>] [--file <stages.json>] [--json]",
    "",
    "Reads <project-dir>/output-stages/stages.json and prints a live PiFlow supervision snapshot.",
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

function listRecentFiles(dirPath, limit = 6, pattern = null) {
  if (!exists(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .map((name) => path.join(dirPath, name))
    .filter((filePath) => fs.statSync(filePath).isFile())
    .filter((filePath) => (pattern ? pattern.test(path.basename(filePath)) : true))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, limit);
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

function buildSnapshot(projectDir, stagesFile, stagesJson) {
  const current = effectiveCurrent(stagesJson);
  const pipeline = stagesJson.pipeline || {};
  const pipelineDir = path.join(projectDir, ".pipeline");
  const lockDir = path.join(pipelineDir, "locks");
  const logsDir = path.join(pipelineDir, "logs");
  const currentStage = current.stage || stagesJson.current_stage || pipeline.current_stage || null;

  return {
    cwd: projectDir,
    file: stagesFile,
    run_id: stagesJson.run_id || pipeline.run_id || null,
    current_stage: currentStage,
    current_state: current.state || current.status || null,
    current_detail: current.detail || null,
    session_id: pipeline.session_id || null,
    pid: current.pid || null,
    teardown_at: stagesJson.teardown_at || null,
    stop_info: stagesJson.stop_info || null,
    current_logs: {
      global: rel(projectDir, current.log_paths && current.log_paths.global),
      stage: rel(projectDir, current.log_paths && current.log_paths.stage),
    },
    recent_global_logs: listRecentFiles(logsDir, 6, /\.log$/).map((item) => path.relative(projectDir, item)),
    recent_recovery_files: listRecentFiles(pipelineDir, 8, /^pipeline-recovery-.*\.json$/).map((item) => path.relative(projectDir, item)),
    lock_files: listRecentFiles(lockDir, 8).map((item) => path.relative(projectDir, item)),
    output_root: exists(path.join(projectDir, "output-stages")) ? "output-stages" : null,
  };
}

function renderMarkdown(snapshot) {
  const lines = [
    "# PiFlow Snapshot",
    "",
    `- 项目目录：${snapshot.cwd}`,
    `- stages.json：${snapshot.file}`,
    `- run_id：${snapshot.run_id || "未知"}`,
    `- 当前 stage：${snapshot.current_stage || "未知"}`,
    `- 当前状态：${snapshot.current_state || "未知"}`,
  ];
  if (snapshot.current_detail) lines.push(`- 当前详情：${snapshot.current_detail}`);
  if (snapshot.session_id) lines.push(`- session_id：${snapshot.session_id}`);
  if (snapshot.pid) lines.push(`- PID：${snapshot.pid}`);
  if (snapshot.teardown_at) lines.push(`- teardown_at：${snapshot.teardown_at}`);
  if (snapshot.current_logs.global || snapshot.current_logs.stage) {
    lines.push("", "## 当前日志");
    if (snapshot.current_logs.global) lines.push(`- global: ${snapshot.current_logs.global}`);
    if (snapshot.current_logs.stage) lines.push(`- stage: ${snapshot.current_logs.stage}`);
  }
  if (snapshot.recent_recovery_files.length) {
    lines.push("", "## Recovery 文件");
    snapshot.recent_recovery_files.forEach((item) => lines.push(`- ${item}`));
  }
  if (snapshot.lock_files.length) {
    lines.push("", "## Lock 文件");
    snapshot.lock_files.forEach((item) => lines.push(`- ${item}`));
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
    const lines = ["项目未开始或非 PiFlow 项目。", `检查路径：${stagesFile}`];
    if (opts.json) console.log(JSON.stringify({ missing: true, cwd: projectDir, file: stagesFile }, null, 2));
    else console.log(lines.join("\n"));
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

  const snapshot = buildSnapshot(projectDir, stagesFile, stagesJson);
  if (opts.json) console.log(JSON.stringify(snapshot, null, 2));
  else console.log(renderMarkdown(snapshot));
}

main();
