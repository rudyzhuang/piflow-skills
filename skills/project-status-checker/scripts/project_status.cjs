#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const COMPLETE = new Set(["complete", "completed", "success", "succeeded", "done", "passed", "ok", "finished"]);
const FAILED = new Set(["fail", "failed", "failure", "error", "errored", "crashed", "rejected"]);
const RUNNING = new Set(["running", "active", "in_progress", "in-progress", "processing", "executing", "started", "working"]);
const PENDING = new Set(["pending", "queued", "waiting", "todo", "not_started", "not-started", "created", "ready"]);

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--cwd") {
      opts.cwd = argv[++i] || opts.cwd;
    } else if (arg.startsWith("--cwd=")) {
      opts.cwd = arg.slice("--cwd=".length);
    } else if (arg === "--file") {
      opts.file = argv[++i];
    } else if (arg.startsWith("--file=")) {
      opts.file = arg.slice("--file=".length);
    } else if (arg === "-h" || arg === "--help") {
      opts.help = true;
    }
  }
  return opts;
}

function usage() {
  return [
    "Usage: node scripts/project_status.cjs [--cwd <project-dir>] [--file <stages.json>] [--json]",
    "",
    "Reads <project-dir>/output-stages/stages.json and prints a PiFlow runtime status report.",
  ].join("\n");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function pick(obj, keys) {
  if (!isPlainObject(obj)) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatus(raw) {
  const value = lower(raw);
  if (!value) return "unknown";
  if (COMPLETE.has(value)) return "completed";
  if (FAILED.has(value)) return "failed";
  if (RUNNING.has(value)) return "running";
  if (PENDING.has(value)) return "pending";
  if (value.includes("success") || value.includes("complete")) return "completed";
  if (value.includes("fail") || value.includes("error")) return "failed";
  if (value.includes("running") || value.includes("progress") || value.includes("execut")) return "running";
  if (value.includes("pending") || value.includes("waiting") || value.includes("queued")) return "pending";
  return value;
}

function parseTime(value) {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value.getTime();
  if (typeof value === "number") {
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function durationFromFields(obj) {
  if (!isPlainObject(obj)) return undefined;
  const msKeys = ["durationMs", "elapsedMs", "runtimeMs", "runTimeMs", "totalRuntimeMs", "executionTimeMs", "timeMs"];
  const secKeys = ["durationSeconds", "elapsedSeconds", "runtimeSeconds", "runTimeSeconds", "seconds"];
  const minKeys = ["durationMinutes", "elapsedMinutes", "runtimeMinutes", "minutes"];
  for (const key of msKeys) {
    const value = numberValue(obj[key]);
    if (value !== undefined) return value;
  }
  for (const key of secKeys) {
    const value = numberValue(obj[key]);
    if (value !== undefined) return value * 1000;
  }
  for (const key of minKeys) {
    const value = numberValue(obj[key]);
    if (value !== undefined) return value * 60 * 1000;
  }
  const start = parseTime(pick(obj, ["startedAt", "startAt", "startTime", "started_at", "start_time", "createdAt"]));
  const end = parseTime(pick(obj, ["endedAt", "endAt", "endTime", "ended_at", "end_time", "finishedAt", "completedAt", "updatedAt"]));
  if (start && end && end >= start) return end - start;
  if (start) {
    const status = normalizeStatus(pick(obj, ["status", "state", "phase", "result"]));
    if (status === "running" || obj.running === true || obj.active === true) return Date.now() - start;
  }
  return undefined;
}

function formatDuration(ms) {
  if (ms === undefined || ms === null || !Number.isFinite(ms)) return "未知";
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}小时`);
  if (minutes) parts.push(`${minutes}分钟`);
  if (seconds || parts.length === 0) parts.push(`${seconds}秒`);
  return parts.join("");
}

function formatDate(value) {
  const ts = parseTime(value);
  return ts ? new Date(ts).toLocaleString("zh-CN", { hour12: false }) : undefined;
}

function arrayFromMaybeMap(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, item]) => (isPlainObject(item) ? { key, ...item } : { key, value: item }));
  }
  return [];
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
    const arr = arrayFromMaybeMap(candidate);
    if (arr.length) return arr;
  }
  if (isPlainObject(data)) {
    const mapLike = Object.entries(data).filter(([, value]) => isPlainObject(value) && looksLikeStage(value));
    if (mapLike.length >= 2) return mapLike.map(([key, value]) => ({ key, ...value }));
  }
  return [];
}

function looksLikeStage(value) {
  if (!isPlainObject(value)) return false;
  return Boolean(
    pick(value, ["status", "state", "phase"]) ||
      pick(value, ["stage", "stageName", "name", "title", "id"]) ||
      pick(value, ["startedAt", "durationMs", "elapsedMs"])
  );
}

function stageName(raw, index) {
  return String(firstDefined(
    pick(raw, ["name", "title", "stageName", "stage", "id", "key", "type"]),
    `stage-${index + 1}`
  ));
}

function taskName(raw, index) {
  return String(firstDefined(
    pick(raw, ["name", "title", "taskName", "label", "id", "key", "type"]),
    `任务 ${index + 1}`
  ));
}

function getTaskCollections(raw) {
  if (!isPlainObject(raw)) return [];
  const keys = ["tasks", "items", "steps", "checks", "subtasks", "subTasks", "children", "todos", "jobs", "actions"];
  const tasks = [];
  for (const key of keys) {
    for (const item of arrayFromMaybeMap(raw[key])) tasks.push(item);
  }
  return tasks;
}

function normalizeTask(raw, index) {
  if (!isPlainObject(raw)) {
    return {
      name: `任务 ${index + 1}`,
      status: normalizeStatus(raw),
      nested: [],
    };
  }
  const explicitStatus = pick(raw, ["status", "state", "phase", "result"]);
  let status = normalizeStatus(explicitStatus);
  if (status === "unknown") {
    if (raw.completed === true || raw.done === true || raw.success === true) status = "completed";
    else if (raw.failed === true || raw.error) status = "failed";
    else if (raw.running === true || raw.active === true) status = "running";
    else if (raw.completed === false || raw.done === false) status = "pending";
  }
  const nested = getTaskCollections(raw).map(normalizeTask);
  return {
    name: taskName(raw, index),
    status,
    durationMs: durationFromFields(raw),
    attempts: numberValue(pick(raw, ["attempts", "attempt", "retryCount", "retries", "runCount"])),
    failures: numberValue(pick(raw, ["failures", "failureCount", "failedCount", "errorCount"])),
    recoveryCount: numberValue(pick(raw, ["recoveryCount", "recoveries", "recoveryAttempts", "recoveredCount"])),
    nested,
  };
}

function sumNumbers(values) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function countFailures(raw, tasks) {
  const explicit = numberValue(pick(raw, ["failures", "failureCount", "failedCount", "errorCount", "failCount"]));
  if (explicit !== undefined) return explicit;
  return tasks.filter((task) => task.status === "failed").length + sumNumbers(tasks.map((task) => task.failures));
}

function countRecovery(raw, tasks) {
  const explicit = numberValue(pick(raw, ["recoveryCount", "recoveries", "recoveryAttempts", "recoveredCount"]));
  if (explicit !== undefined) return explicit;
  return sumNumbers(tasks.map((task) => task.recoveryCount));
}

function normalizeStage(raw, index) {
  if (!isPlainObject(raw)) {
    return {
      name: `stage-${index + 1}`,
      status: normalizeStatus(raw),
      durationMs: undefined,
      failures: 0,
      recoveryCount: 0,
      tasks: [],
      output: undefined,
    };
  }
  const tasks = getTaskCollections(raw).map(normalizeTask);
  let status = normalizeStatus(pick(raw, ["status", "state", "phase", "result"]));
  if (status === "unknown") {
    if (raw.completed === true || raw.done === true || raw.success === true) status = "completed";
    else if (raw.failed === true || raw.error) status = "failed";
    else if (raw.running === true || raw.active === true) status = "running";
    else if (raw.completed === false || raw.done === false) status = "pending";
  }
  return {
    name: stageName(raw, index),
    status,
    durationMs: durationFromFields(raw),
    startedAt: formatDate(pick(raw, ["startedAt", "startAt", "startTime", "started_at", "start_time"])),
    endedAt: formatDate(pick(raw, ["endedAt", "endAt", "endTime", "ended_at", "end_time", "finishedAt", "completedAt"])),
    attempts: numberValue(pick(raw, ["attempts", "attempt", "retryCount", "retries", "runCount"])),
    failures: countFailures(raw, tasks),
    recoveryCount: countRecovery(raw, tasks),
    tasks,
    output: pick(raw, ["output", "outputPath", "artifact", "artifactPath", "resultPath"]),
  };
}

function flattenTasks(tasks) {
  const result = [];
  for (const task of tasks) {
    result.push(task);
    result.push(...flattenTasks(task.nested || []));
  }
  return result;
}

function extractProjectInfo(data) {
  const sources = [data.project, data.projectInfo, data.metadata, data.meta, data.summary, data.req, data.request, data];
  const name = firstDefined(...sources.map((source) => pick(source, ["projectName", "name", "title", "appName"])));
  const description = firstDefined(...sources.map((source) => pick(source, ["description", "brief", "summary", "intro", "prompt", "goal"])));
  const createdAt = firstDefined(...sources.map((source) => pick(source, ["createdAt", "startedAt", "startTime"])));
  const updatedAt = firstDefined(...sources.map((source) => pick(source, ["updatedAt", "lastUpdatedAt", "modifiedAt", "endedAt"])));
  return {
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    createdAt: formatDate(createdAt),
    updatedAt: formatDate(updatedAt),
  };
}

function summarize(data, filePath) {
  const stages = findStageCollection(data).map(normalizeStage);
  const completedStages = stages.filter((stage) => stage.status === "completed");
  const failedStages = stages.filter((stage) => stage.status === "failed");
  const runningStages = stages.filter((stage) => stage.status === "running");
  const pendingStages = stages.filter((stage) => stage.status === "pending");
  const unknownStages = stages.filter((stage) => !["completed", "failed", "running", "pending"].includes(stage.status));
  const allTasks = stages.flatMap((stage) => flattenTasks(stage.tasks));
  const totalRuntimeMs = sumNumbers(completedStages.map((stage) => stage.durationMs));
  const runningRuntimeMs = sumNumbers(runningStages.map((stage) => stage.durationMs));
  return {
    filePath,
    project: extractProjectInfo(data),
    counts: {
      totalStages: stages.length,
      completedStages: completedStages.length,
      failedStages: failedStages.length,
      runningStages: runningStages.length,
      pendingStages: pendingStages.length,
      unknownStages: unknownStages.length,
      totalTasks: allTasks.length,
      completedTasks: allTasks.filter((task) => task.status === "completed").length,
      failedTasks: allTasks.filter((task) => task.status === "failed").length,
      runningTasks: allTasks.filter((task) => task.status === "running").length,
      pendingTasks: allTasks.filter((task) => task.status === "pending").length,
    },
    runtime: {
      completedTotalMs: totalRuntimeMs || undefined,
      runningTotalMs: runningRuntimeMs || undefined,
    },
    failures: sumNumbers(stages.map((stage) => stage.failures)),
    recoveries: sumNumbers(stages.map((stage) => stage.recoveryCount)),
    stages,
    completedStages,
    failedStages,
    runningStages,
    pendingStages,
    unknownStages,
  };
}

function listLine(items, render) {
  if (!items.length) return "- 无";
  return items.map(render).join("\n");
}

function renderTasks(title, tasks) {
  return [
    `### ${title}`,
    listLine(tasks, (task) => `- ${task.name}${task.durationMs !== undefined ? `（${formatDuration(task.durationMs)}）` : ""}`),
  ].join("\n");
}

function renderReport(summary) {
  const projectName = summary.project.name || "未识别";
  const projectBrief = summary.project.description || "未识别";
  const lines = [];
  lines.push("# 当前项目运行状态");
  lines.push("");
  lines.push(`- 数据文件: ${summary.filePath}`);
  lines.push(`- 项目名称: ${projectName}`);
  lines.push(`- 项目简介: ${projectBrief}`);
  if (summary.project.createdAt) lines.push(`- 开始时间: ${summary.project.createdAt}`);
  if (summary.project.updatedAt) lines.push(`- 最近更新时间: ${summary.project.updatedAt}`);
  lines.push(`- Stage 统计: 总计 ${summary.counts.totalStages}，已完成 ${summary.counts.completedStages}，运行中 ${summary.counts.runningStages}，失败 ${summary.counts.failedStages}，未开始/等待 ${summary.counts.pendingStages}`);
  lines.push(`- 子项/任务统计: 总计 ${summary.counts.totalTasks}，已完成 ${summary.counts.completedTasks}，运行中 ${summary.counts.runningTasks}，失败 ${summary.counts.failedTasks}，未完成 ${summary.counts.pendingTasks}`);
  lines.push(`- 已完成 stage 总计运行时间: ${formatDuration(summary.runtime.completedTotalMs)}`);
  lines.push(`- 失败次数: ${summary.failures}`);
  lines.push(`- Recovery 次数: ${summary.recoveries}`);
  lines.push("");
  lines.push("## 已完成 Stage");
  lines.push(listLine(summary.completedStages, (stage) => `- ${stage.name}: ${formatDuration(stage.durationMs)}${stage.attempts ? `，尝试 ${stage.attempts} 次` : ""}`));
  lines.push("");
  lines.push("## 失败 Stage");
  lines.push(listLine(summary.failedStages, (stage) => `- ${stage.name}: 已运行 ${formatDuration(stage.durationMs)}，失败 ${stage.failures || 0} 次，recovery ${stage.recoveryCount || 0} 次`));
  lines.push("");
  lines.push("## 当前正在执行的 Stage");
  if (!summary.runningStages.length) {
    lines.push("- 无");
  } else {
    for (const stage of summary.runningStages) {
      const tasks = flattenTasks(stage.tasks);
      const done = tasks.filter((task) => task.status === "completed");
      const failed = tasks.filter((task) => task.status === "failed");
      const running = tasks.filter((task) => task.status === "running");
      const notDone = tasks.filter((task) => task.status !== "completed");
      lines.push(`### ${stage.name}`);
      lines.push(`- 已运行: ${formatDuration(stage.durationMs)}`);
      lines.push(`- 失败次数: ${stage.failures || 0}`);
      lines.push(`- Recovery 次数: ${stage.recoveryCount || 0}`);
      if (stage.startedAt) lines.push(`- 开始时间: ${stage.startedAt}`);
      if (stage.output) lines.push(`- 输出: ${typeof stage.output === "string" ? stage.output : JSON.stringify(stage.output)}`);
      lines.push("");
      lines.push(renderTasks("已完成子项/任务", done));
      lines.push("");
      lines.push(renderTasks("正在执行子项/任务", running));
      lines.push("");
      lines.push(renderTasks("未完成子项/任务", notDone.filter((task) => task.status !== "running")));
      if (failed.length) {
        lines.push("");
        lines.push(renderTasks("失败子项/任务", failed));
      }
    }
  }
  if (summary.pendingStages.length) {
    lines.push("");
    lines.push("## 未开始/等待 Stage");
    lines.push(listLine(summary.pendingStages, (stage) => `- ${stage.name}`));
  }
  if (summary.unknownStages.length) {
    lines.push("");
    lines.push("## 未识别状态 Stage");
    lines.push(listLine(summary.unknownStages, (stage) => `- ${stage.name}: ${stage.status}`));
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
  const filePath = path.resolve(opts.file || path.join(cwd, "output-stages", "stages.json"));
  if (!fs.existsSync(filePath)) {
    const result = {
      ok: false,
      reason: "missing",
      message: "项目未开始或非 PiFlow 项目。",
      filePath,
    };
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.log(`${result.message}\n检查路径: ${filePath}`);
    return;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const result = { ok: false, reason: "parse_error", message: error.message, filePath };
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else console.error(`stages.json 解析失败: ${error.message}\n文件: ${filePath}`);
    process.exitCode = 1;
    return;
  }
  const summary = summarize(data, filePath);
  const result = { ok: true, ...summary };
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderReport(summary));
}

main();
