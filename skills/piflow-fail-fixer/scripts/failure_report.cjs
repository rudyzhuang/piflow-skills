#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FAILED = new Set(["fail", "failed", "failure", "error", "errored", "crashed", "rejected"]);
const COMPLETE = new Set(["complete", "completed", "success", "succeeded", "done", "passed", "ok", "finished"]);
const RUNNING = new Set(["running", "active", "in_progress", "in-progress", "processing", "executing", "started", "working"]);

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
    "Usage: node scripts/failure_report.cjs [--cwd <project-dir>] [--file <stages.json>] [--json]",
    "",
    "Reads <project-dir>/output-stages/stages.json and extracts the latest failed PiFlow report.",
  ].join("\n");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, item]) => (isPlainObject(item) ? { key, ...item } : { key, value: item }));
  }
  return [];
}

function pick(obj, keys) {
  if (!isPlainObject(obj)) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function compact(values) {
  return values.filter((value) => value !== undefined && value !== null && value !== "");
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(raw) {
  const value = lower(raw);
  if (!value) return "unknown";
  if (FAILED.has(value)) return "failed";
  if (COMPLETE.has(value)) return "completed";
  if (RUNNING.has(value)) return "running";
  if (value.includes("fail") || value.includes("error") || value.includes("crash")) return "failed";
  if (value.includes("success") || value.includes("complete") || value.includes("passed")) return "completed";
  if (value.includes("running") || value.includes("progress") || value.includes("execut")) return "running";
  return value;
}

function parseTime(value) {
  if (!value) return undefined;
  if (typeof value === "number") {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function stringify(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  if (isPlainObject(value) || Array.isArray(value)) return JSON.stringify(value, null, 2);
  return String(value);
}

function nameOf(raw, fallback) {
  return String(pick(raw, ["name", "title", "stageName", "stage", "taskName", "label", "id", "key", "type"]) || fallback);
}

function findStageCollection(data) {
  if (Array.isArray(data)) return data;
  const candidates = [
    data.stages,
    data.stageResults,
    data.stage_runs,
    data.stageRuns,
    data.pipeline?.stages,
    data.execution?.stages,
    data.result?.stages,
    data.results?.stages,
  ];
  for (const candidate of candidates) {
    const items = asArray(candidate);
    if (items.length) return items;
  }
  if (isPlainObject(data)) {
    const mapLike = Object.entries(data).filter(([, value]) => isPlainObject(value) && looksLikeNode(value));
    if (mapLike.length) return mapLike.map(([key, value]) => ({ key, ...value }));
  }
  return [];
}

function looksLikeNode(value) {
  return Boolean(
    isPlainObject(value) &&
      (pick(value, ["status", "state", "phase", "result"]) ||
        pick(value, ["stage", "stageName", "taskName", "name", "title", "id"]) ||
        pick(value, ["error", "message", "report", "logs", "logPath"]))
  );
}

function nestedNodes(raw) {
  const keys = ["tasks", "items", "steps", "checks", "subtasks", "subTasks", "children", "todos", "jobs", "actions"];
  return keys.flatMap((key) => asArray(raw[key]));
}

function collectPaths(raw) {
  const values = compact([
    pick(raw, ["reportPath", "failureReportPath", "errorReportPath", "reportFile"]),
    pick(raw, ["logPath", "logFile", "logsPath", "stderrPath", "stdoutPath"]),
    pick(raw, ["outputPath", "artifactPath", "resultPath", "tracePath"]),
  ]);
  for (const key of ["logs", "reports", "artifacts", "outputs"]) {
    const value = raw[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") values.push(item);
        else if (isPlainObject(item)) values.push(...compact([item.path, item.file, item.href]));
      }
    }
  }
  return [...new Set(values.map(String))];
}

function collectFields(raw, fields) {
  return compact(fields.map((key) => stringify(raw[key])));
}

function collectMessages(raw) {
  const errorFields = [
    "failureReport",
    "errorReport",
    "report",
    "summary",
    "message",
    "error",
    "stderr",
    "details",
    "reason",
    "diagnosis",
  ];
  const contextFields = ["stdout"];
  return {
    errorMessages: collectFields(raw, errorFields),
    contextMessages: collectFields(raw, contextFields),
  };
}

function visitNode(raw, ancestry, index, failures) {
  if (!isPlainObject(raw)) return;
  const status = normalizeStatus(pick(raw, ["status", "state", "phase", "result"]));
  const currentName = nameOf(raw, ancestry.length ? `step-${index + 1}` : `stage-${index + 1}`);
  const { errorMessages, contextMessages } = collectMessages(raw);
  const node = {
    name: currentName,
    path: [...ancestry, currentName],
    status,
    startedAt: pick(raw, ["startedAt", "startAt", "startTime", "started_at", "start_time"]),
    endedAt: pick(raw, ["endedAt", "endAt", "endTime", "ended_at", "end_time", "finishedAt", "completedAt", "updatedAt"]),
    updatedAt: pick(raw, ["updatedAt", "modifiedAt", "mtime"]),
    command: pick(raw, ["command", "cmd", "script", "argv", "run"]),
    exitCode: pick(raw, ["exitCode", "code", "statusCode"]),
    messages: [...errorMessages, ...contextMessages],
    errorMessages,
    contextMessages,
    paths: collectPaths(raw),
    raw,
  };
  if (hasFailureSignal(node)) failures.push(node);
  nestedNodes(raw).forEach((child, childIndex) => visitNode(child, node.path, childIndex, failures));
}

function sortTime(node) {
  return parseTime(node.endedAt) || parseTime(node.updatedAt) || parseTime(node.startedAt) || 0;
}

function firstUsefulLine(messages) {
  const joined = messages.join("\n");
  const lines = joined.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => /error|failed|exception|traceback|cannot|not found|timeout|fatal/i.test(line)) || lines[0];
}

function hasFailureSignal(node) {
  if (node.status === "failed") return true;
  const exitCode = Number(node.exitCode);
  if (Number.isFinite(exitCode) && exitCode !== 0) return true;
  return node.errorMessages.some((message) => /error|failed|failure|exception|traceback|cannot|not found|timeout|fatal|crash/i.test(message));
}

function renderMarkdown(result) {
  if (result.missing) {
    return [`项目未开始或非 PiFlow 项目。`, `检查路径：${result.file}`].join("\n");
  }
  if (result.parseError) {
    return [`无法解析 stages.json。`, `检查路径：${result.file}`, `错误：${result.parseError}`].join("\n");
  }
  if (!result.failure) {
    return [`未在 stages.json 中找到失败 stage 或失败报告。`, `检查路径：${result.file}`].join("\n");
  }

  const failure = result.failure;
  const lines = [
    "# 最新失败报告",
    "",
    `- 项目目录：${result.cwd}`,
    `- stages.json：${result.file}`,
    `- 失败节点：${failure.path.join(" > ")}`,
    `- 状态：${failure.status}`,
  ];
  if (failure.command) lines.push(`- 命令：${Array.isArray(failure.command) ? failure.command.join(" ") : failure.command}`);
  if (failure.exitCode !== undefined) lines.push(`- 退出码：${failure.exitCode}`);
  if (failure.startedAt) lines.push(`- 开始时间：${failure.startedAt}`);
  if (failure.endedAt) lines.push(`- 结束时间：${failure.endedAt}`);
  const signal = firstUsefulLine(failure.messages);
  if (signal) lines.push(`- 关键错误：${signal}`);
  if (failure.paths.length) {
    lines.push("", "## 相关文件/日志");
    for (const item of failure.paths) lines.push(`- ${item}`);
  }
  if (failure.messages.length) {
    lines.push("", "## 报告摘录");
    const excerpt = failure.messages.join("\n\n").split(/\r?\n/).slice(0, 80).join("\n");
    lines.push("```text", excerpt, "```");
  }
  return lines.join("\n");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  const cwd = path.resolve(opts.cwd);
  const file = path.resolve(opts.file || path.join(cwd, "output-stages", "stages.json"));
  const result = { cwd, file };

  if (!fs.existsSync(file)) {
    result.missing = true;
    console.log(opts.json ? JSON.stringify(result, null, 2) : renderMarkdown(result));
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    result.parseError = error.message;
    console.log(opts.json ? JSON.stringify(result, null, 2) : renderMarkdown(result));
    process.exit(1);
  }

  const failures = [];
  findStageCollection(data).forEach((stage, index) => visitNode(stage, [], index, failures));
  failures.sort((a, b) => sortTime(a) - sortTime(b));
  result.failureCount = failures.length;
  result.failure = failures[failures.length - 1] || null;

  console.log(opts.json ? JSON.stringify(result, null, 2) : renderMarkdown(result));
}

main();
