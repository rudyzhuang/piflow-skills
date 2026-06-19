#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FAILURE_WORDS = /error|fail|failure|exception|traceback|timeout|fatal|crash|blocked/i;
const MAX_ITEMS = 8;

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
    "Usage: node scripts/failure_context.cjs [--cwd <project-dir>] [--file <stages.json>] [--json]",
    "",
    "Reads the PiFlow project state and expands the latest failure into repair context.",
  ].join("\n");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
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

function pick(obj, keys) {
  if (!isPlainObject(obj)) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(raw) {
  const value = lower(raw);
  if (!value) return "unknown";
  if (/(fail|error|crash|reject)/.test(value)) return "failed";
  if (/(run|progress|execut|active|working|processing)/.test(value)) return "running";
  if (/(stop|block)/.test(value)) return value.includes("block") ? "blocked" : "stopped";
  if (/(success|complete|pass|done|ok|finish)/.test(value)) return "completed";
  return value;
}

function parseTime(value) {
  if (!value) return 0;
  if (typeof value === "number") return value > 1e12 ? value : value > 1e9 ? value * 1000 : 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function runIdToLogToken(runId) {
  if (!runId) return "";
  const match = String(runId).match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return "";
  return `${match[1]}_${match[2]}-${match[3]}-${match[4]}`;
}

function rel(projectDir, targetPath) {
  if (!targetPath) return undefined;
  const absolute = path.isAbsolute(targetPath) ? targetPath : path.join(projectDir, targetPath);
  return exists(absolute) ? path.relative(projectDir, absolute) : targetPath;
}

function listFiles(dirPath, filterFn) {
  if (!exists(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .map((name) => path.join(dirPath, name))
    .filter((fullPath) => fs.statSync(fullPath).isFile())
    .filter((fullPath) => (filterFn ? filterFn(fullPath) : true));
}

function readTail(filePath, maxLines = 40) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines).join("\n");
  } catch {
    return undefined;
  }
}

function stageToken(stageName) {
  return String(stageName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function pickFailure(stagesJson) {
  const pipeline = stagesJson.pipeline || {};
  const history = Array.isArray(pipeline.recovery_history) ? pipeline.recovery_history : [];
  if (history.length) {
    const latest = history.slice().sort((a, b) => parseTime(b.at || b.updated_at) - parseTime(a.at || a.updated_at))[0];
    return {
      stage: latest.stage || latest.failed_stage || pick(latest.recovery_context_summary, ["failed_stage"]),
      status: normalizeStatus(latest.status || latest.decision || latest.exit_code ? "failed" : undefined),
      runId: latest.run_id,
      reason: latest.reason || latest.root_cause || pick(latest.recovery_context_summary, ["status"]),
      recovery: latest,
    };
  }

  const current = stagesJson.current || {};
  const currentStatus = normalizeStatus(current.state || current.status);
  if (["failed", "blocked", "stopped"].includes(currentStatus)) {
    return {
      stage: current.stage || stagesJson.current_stage || pipeline.current_stage,
      status: currentStatus,
      runId: stagesJson.run_id || pipeline.run_id,
      reason: current.detail,
      recovery: null,
    };
  }

  return {
    stage: stagesJson.current_stage || pipeline.current_stage || current.stage,
    status: currentStatus,
    runId: stagesJson.run_id || pipeline.run_id,
    reason: current.detail,
    recovery: null,
  };
}

function collectArtifacts(projectDir, stageName) {
  const token = stageToken(stageName);
  const outputRoot = path.join(projectDir, "output-stages");
  const results = [];
  const stageDir = token ? path.join(outputRoot, token) : null;
  if (stageDir && exists(stageDir)) results.push(path.relative(projectDir, stageDir));

  const candidateDirs = [
    stageDir,
    path.join(outputRoot, token, "agent-inputs"),
    path.join(outputRoot, token, "context"),
    path.join(outputRoot, token, "agent-support"),
  ].filter(Boolean).filter(exists);

  for (const dirPath of candidateDirs) {
    const files = listFiles(dirPath).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, MAX_ITEMS);
    for (const filePath of files) results.push(path.relative(projectDir, filePath));
  }

  return [...new Set(results)];
}

function collectLogRefs(projectDir, failure, stagesJson) {
  const current = stagesJson.current || {};
  const refs = new Set();
  const recovery = failure.recovery;
  const currentLogs = current.log_paths || {};
  const runLogToken = runIdToLogToken(failure.runId);
  for (const value of [currentLogs.global, currentLogs.stage]) {
    if (value) refs.add(rel(projectDir, value));
  }

  if (recovery && Array.isArray(recovery.evidence_refs)) {
    for (const item of recovery.evidence_refs) {
      const evidenceStage = item && item.stage;
      if (evidenceStage && !["pipeline", "stages_json", failure.stage].includes(evidenceStage)) continue;
      const candidate = rel(projectDir, item && item.path);
      if (!candidate || !candidate.endsWith(".log")) continue;
      if (evidenceStage === "pipeline" && runLogToken && !path.basename(candidate).includes(runLogToken)) continue;
      refs.add(candidate);
    }
  }

  const stageName = failure.stage || current.stage;
  const stageLogDir = path.join(projectDir, ".pipeline", "logs", "stages", String(stageName || ""));
  if (exists(stageLogDir)) {
    listFiles(stageLogDir, (filePath) => !runLogToken || path.basename(filePath).includes(runLogToken))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      .slice(0, 3)
      .forEach((filePath) => refs.add(path.relative(projectDir, filePath)));
  }

  const globalLogDir = path.join(projectDir, ".pipeline", "logs");
  if (exists(globalLogDir)) {
    listFiles(globalLogDir, (filePath) => filePath.endsWith(".log") && (!runLogToken || path.basename(filePath).includes(runLogToken)))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
      .slice(0, 3)
      .forEach((filePath) => refs.add(path.relative(projectDir, filePath)));
  }

  return [...refs].filter(Boolean);
}

function collectRecoveryRefs(projectDir) {
  const pipelineDir = path.join(projectDir, ".pipeline");
  if (!exists(pipelineDir)) return [];
  return listFiles(pipelineDir, (filePath) => /pipeline-recovery-.*\.json$|merge-last-error\.json$|merge-triage\.json$|reconcile-report\.json$/.test(path.basename(filePath)))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    .slice(0, MAX_ITEMS)
    .map((filePath) => path.relative(projectDir, filePath));
}

function buildResult(projectDir, stagesFile, stagesJson) {
  const failure = pickFailure(stagesJson);
  const logRefs = collectLogRefs(projectDir, failure, stagesJson);
  const artifactRefs = collectArtifacts(projectDir, failure.stage);
  const recoveryRefs = collectRecoveryRefs(projectDir);
  const stageLogPath = logRefs.find((item) => item.includes(`logs/stages/${failure.stage || ""}/`));
  const globalLogPath = logRefs.find((item) => item.startsWith(".pipeline/logs/") && !item.includes("/stages/"));
  const stageLogTail = stageLogPath ? readTail(path.join(projectDir, stageLogPath)) : undefined;
  const globalLogTail = globalLogPath ? readTail(path.join(projectDir, globalLogPath)) : undefined;

  const signalCandidates = [stageLogTail, globalLogTail, failure.reason]
    .filter(Boolean)
    .flatMap((chunk) => String(chunk).split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  const keySignal = signalCandidates.find((line) => FAILURE_WORDS.test(line)) || signalCandidates[0];

  return {
    cwd: projectDir,
    file: stagesFile,
    run_id: failure.runId || stagesJson.run_id,
    stage: failure.stage,
    status: failure.status,
    reason: failure.reason,
    key_signal: keySignal,
    log_paths: logRefs,
    artifact_paths: artifactRefs,
    recovery_paths: recoveryRefs,
    current: stagesJson.current || {},
    stop_info: stagesJson.stop_info || null,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# 失败修复上下文",
    "",
    `- 项目目录：${result.cwd}`,
    `- stages.json：${result.file}`,
    `- run_id：${result.run_id || "未知"}`,
    `- stage：${result.stage || "未知"}`,
    `- 状态：${result.status || "未知"}`,
  ];
  if (result.reason) lines.push(`- 原因摘要：${result.reason}`);
  if (result.key_signal) lines.push(`- 关键失败信号：${result.key_signal}`);
  if (result.log_paths.length) {
    lines.push("", "## 日志路径");
    result.log_paths.forEach((item) => lines.push(`- ${item}`));
  }
  if (result.artifact_paths.length) {
    lines.push("", "## 相关产物");
    result.artifact_paths.forEach((item) => lines.push(`- ${item}`));
  }
  if (result.recovery_paths.length) {
    lines.push("", "## Recovery 相关文件");
    result.recovery_paths.forEach((item) => lines.push(`- ${item}`));
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
    const result = { missing: true, cwd: projectDir, file: stagesFile };
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(["项目未开始或非 PiFlow 项目。", `检查路径：${stagesFile}`].join("\n"));
    process.exitCode = 1;
    return;
  }

  let stagesJson;
  try {
    stagesJson = readJson(stagesFile);
  } catch (error) {
    const result = { parse_error: error.message, cwd: projectDir, file: stagesFile };
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(["无法解析 stages.json。", `检查路径：${stagesFile}`, `错误：${error.message}`].join("\n"));
    process.exitCode = 1;
    return;
  }

  const result = buildResult(projectDir, stagesFile, stagesJson);
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderMarkdown(result));
}

main();
