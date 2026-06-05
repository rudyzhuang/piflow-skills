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

function normalizeKey(key) {
  return String(key || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function findFirstDeep(root, keys, maxDepth = 6) {
  const wanted = new Set(keys.map(normalizeKey));
  const seen = new Set();

  function visit(value, depth) {
    if (value === undefined || value === null || depth > maxDepth) return undefined;
    if (typeof value !== "object") return undefined;
    if (seen.has(value)) return undefined;
    seen.add(value);

    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (wanted.has(normalizeKey(key)) && item !== undefined && item !== null && item !== "") return item;
      }
      for (const item of Object.values(value)) {
        const found = visit(item, depth + 1);
        if (found !== undefined) return found;
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  return visit(root, 0);
}

function findAllDeep(root, keys, maxDepth = 6) {
  const wanted = new Set(keys.map(normalizeKey));
  const seen = new Set();
  const results = [];

  function visit(value, depth) {
    if (value === undefined || value === null || depth > maxDepth) return;
    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (wanted.has(normalizeKey(key)) && item !== undefined && item !== null && item !== "") results.push(item);
      }
      for (const item of Object.values(value)) visit(item, depth + 1);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
    }
  }

  visit(root, 0);
  return results;
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

function stringifyValue(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
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
      name: stringifyValue(raw) || `任务 ${index + 1}`,
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
    group: stringifyValue(pick(raw, ["group", "groupId", "group_id"])),
    branch: stringifyValue(pick(raw, ["branch", "gitBranch", "featureBranch"])),
    worktree: stringifyValue(pick(raw, ["worktree", "worktreePath", "worktree_path"])),
    agent: stringifyValue(pick(raw, ["agent", "agentId", "agentName", "worker"])),
    nested,
  };
}

function normalizeStatusTask(raw, status, index) {
  const task = normalizeTask(raw, index);
  task.status = status;
  return task;
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
    pid: numberValue(pick(raw, ["pid", "processId", "process_id", "currentPid"])),
    log: stringifyValue(pick(raw, ["log", "logPath", "stageLog", "stageLogPath"])),
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
  const sources = [data.project, data.projectInfo, data.pipeline?.project, data.metadata, data.meta, data.summary, data.req, data.request, data];
  const gitSources = [data.git, data.remote, data.repository, data.repo, data.project?.git, data.projectInfo?.git, data.pipeline?.project?.git, data.metadata?.git, data.meta?.git, data];
  const name = firstDefined(...sources.map((source) => pick(source, ["projectName", "name", "title", "appName"])));
  const description = firstDefined(...sources.map((source) => pick(source, ["description", "brief", "summary", "intro", "prompt", "goal"])));
  const createdAt = firstDefined(...sources.map((source) => pick(source, ["createdAt", "startedAt", "startTime"])));
  const updatedAt = firstDefined(...sources.map((source) => pick(source, ["updatedAt", "lastUpdatedAt", "modifiedAt", "endedAt"])));
  return {
    id: stringifyValue(firstDefined(...sources.map((source) => pick(source, ["projectId", "project_id", "id"])), findFirstDeep(data, ["projectId", "project_id"]))),
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    rootDir: stringifyValue(firstDefined(...sources.map((source) => pick(source, ["rootDir", "root_dir", "rootPath", "root_path", "projectRoot", "project_root", "root", "cwd", "workspace"])), findFirstDeep(data, ["rootDir", "rootPath", "root_path", "projectRoot", "project_root"]))),
    gitRemote: stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["remote", "remoteName", "remote_name", "gitRemote"])))),
    remoteUrl: stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["remoteUrl", "remote_url", "url", "gitUrl"])))),
    defaultBranch: stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["defaultBranch", "default_branch", "branch", "mainBranch"])))),
    remoteConfiguredAt: formatDate(firstDefined(...gitSources.map((source) => pick(source, ["remoteConfiguredAt", "remote_configured_at", "configuredAt", "configured_at"])))),
    createdAt: formatDate(createdAt),
    updatedAt: formatDate(updatedAt),
  };
}

function extractPipelineInfo(data, stages, filePath) {
  const sources = [data.pipeline, data.execution, data.run, data.runtime, data.status, data.metadata, data.meta, data];
  const currentSources = [data.pipeline?.current, data.current, data.execution?.current, data.run?.current];
  const runningStage = stages.find((stage) => stage.status === "running");
  const completedStages = stages.filter((stage) => stage.status === "completed");
  const currentStage = stringifyValue(firstDefined(
    ...currentSources.map((source) => pick(source, ["stage", "currentStage", "current_stage", "runningStage", "activeStage"])),
    ...sources.map((source) => pick(source, ["currentStage", "current_stage", "runningStage", "activeStage", "stage"])),
    runningStage?.name
  ));
  const currentStatus = stringifyValue(firstDefined(
    ...currentSources.map((source) => pick(source, ["state", "status", "currentStatus", "current_status"])),
    ...sources.map((source) => pick(source, ["currentStatus", "current_status", "status", "state"])),
    runningStage ? "running" : undefined
  ));
  const recentCompletedStage = stringifyValue(firstDefined(
    ...sources.map((source) => pick(source, ["recentCompletedStage", "recent_completed_stage", "lastCompletedStage", "last_completed_stage"])),
    completedStages.length ? completedStages[completedStages.length - 1].name : undefined
  ));
  const pid = numberValue(firstDefined(
    ...currentSources.map((source) => pick(source, ["pid", "processId", "process_id", "currentPid", "current_pid"])),
    ...sources.map((source) => pick(source, ["pid", "processId", "process_id", "currentPid", "current_pid"])),
    runningStage?.pid,
    findFirstDeep(data, ["currentPid", "processId", "pid"], 4)
  ));
  const currentStageStartedAt = formatDate(firstDefined(
    ...currentSources.map((source) => pick(source, ["startedAt", "started_at", "startTime", "start_time", "stageStartedAt", "stage_started_at"])),
    ...sources.map((source) => pick(source, ["currentStageStartedAt", "current_stage_started_at", "stageStartedAt", "stage_started_at", `${currentStage}StartedAt`])),
    runningStage?.startedAt
  ));
  const stagesUpdatedAt = formatDate(firstDefined(
    ...currentSources.map((source) => pick(source, ["heartbeatAt", "heartbeat_at", "updatedAt", "updated_at"])),
    ...sources.map((source) => pick(source, ["stagesUpdatedAt", "stages_updated_at", "updatedAt", "updated_at", "lastUpdatedAt"])),
    fs.statSync(filePath).mtime
  ));
  const logSources = [data.logs, data.log, data.pipeline?.logs, data.pipeline?.log, data.pipeline?.current?.log_paths, data.pipeline?.current?.logs, data.metadata?.logs, data.meta?.logs, data];
  return {
    currentStage,
    currentStatus,
    recentCompletedStage,
    pid,
    detail: stringifyValue(firstDefined(...currentSources.map((source) => pick(source, ["detail", "message", "reason", "error"])))),
    heartbeatAt: formatDate(firstDefined(...currentSources.map((source) => pick(source, ["heartbeatAt", "heartbeat_at"])))),
    elapsedMs: numberValue(firstDefined(...currentSources.map((source) => pick(source, ["elapsedMs", "elapsed_ms", "durationMs", "duration_ms"])))),
    currentStageStartedAt,
    stagesUpdatedAt,
    globalLog: stringifyValue(firstDefined(...logSources.map((source) => pick(source, ["global", "globalLog", "globalLogPath", "pipelineLog", "pipelineLogPath", "logPath"])))),
    stageLog: stringifyValue(firstDefined(...logSources.map((source) => pick(source, ["stage", "stageLog", "stageLogPath", "currentStageLog", "currentStageLogPath"])), runningStage?.log)),
  };
}

function taskFeatureId(task) {
  return task.name;
}

function extractCodegenProgress(data, stages) {
  const codegenStage = stages.find((stage) => normalizeKey(stage.name).includes("codegen"));
  const sources = [data.codegen, data.codegenProgress, data.pipeline?.codegen, data.pipeline?.codegenProgress, data.progress?.codegen, data.stages?.codegen, data.stages?.codegen_progress];
  const sourceTasks = firstDefined(...sources.map((source) => pick(source, ["tasks", "items", "features", "queue", "featureItems"])));
  let tasks = arrayFromMaybeMap(sourceTasks).length ? arrayFromMaybeMap(sourceTasks).map(normalizeTask) : [];
  if (!tasks.length) {
    const completedItems = arrayFromMaybeMap(firstDefined(...sources.map((source) => pick(source, ["completedItems", "completedTasks", "completedFeatures", "completedList", "doneItems", "done"]))));
    const runningItems = arrayFromMaybeMap(firstDefined(...sources.map((source) => pick(source, ["runningItems", "runningTasks", "runningFeatures", "activeItems", "active"]))));
    const pendingItems = arrayFromMaybeMap(firstDefined(...sources.map((source) => pick(source, ["pendingItems", "pendingTasks", "pendingFeatures", "queuedItems", "todoItems", "todo", "queued"]))));
    tasks = [
      ...completedItems.map((item, index) => normalizeStatusTask(item, "completed", index)),
      ...runningItems.map((item, index) => normalizeStatusTask(item, "running", index)),
      ...pendingItems.map((item, index) => normalizeStatusTask(item, "pending", index)),
    ];
  }
  if (!tasks.length) tasks = codegenStage?.tasks || [];
  const flat = flattenTasks(tasks);
  const completed = flat.filter((task) => task.status === "completed");
  const running = flat.filter((task) => task.status === "running");
  const pending = flat.filter((task) => task.status === "pending");
  const explicitCounts = {
    completed: numberValue(firstDefined(...sources.map((source) => pick(source, ["completed", "completedCount", "doneCount"])))),
    running: numberValue(firstDefined(...sources.map((source) => pick(source, ["running", "runningCount", "activeCount"])))),
    pending: numberValue(firstDefined(...sources.map((source) => pick(source, ["pending", "pendingCount", "todoCount", "queuedCount"])))),
  };
  if (!flat.length && explicitCounts.completed === undefined && explicitCounts.running === undefined && explicitCounts.pending === undefined) {
    return undefined;
  }
  return {
    completedCount: explicitCounts.completed ?? completed.length,
    runningCount: explicitCounts.running ?? running.length,
    pendingCount: explicitCounts.pending ?? pending.length,
    running,
    completed,
    pending,
  };
}

function normalizeRecoveryRecord(raw, index) {
  if (!isPlainObject(raw)) return { title: stringifyValue(raw) || `恢复记录 ${index + 1}` };
  const stage = stringifyValue(pick(raw, ["stage", "stageName", "stage_name", "name"]));
  const count = numberValue(pick(raw, ["count", "times", "recoveryCount", "recoveries", "attempts"]));
  const message = stringifyValue(pick(raw, ["message", "summary", "description", "reason", "fix", "result", "note"]));
  const rerunScope = raw.rerun_scope || raw.project_continuation_plan;
  const rootCause = raw.root_cause;
  return {
    stage,
    count,
    message,
    attempt: numberValue(pick(raw, ["attempt", "attempts"])),
    decision: stringifyValue(pick(raw, ["decision", "action"])),
    repairTarget: stringifyValue(pick(raw, ["repairTarget", "repair_target"])),
    category: stringifyValue(pick(raw, ["category", "failureLayer", "failure_layer"])),
    failureSignatureId: stringifyValue(pick(raw, ["failureSignatureId", "failure_signature_id", "signature"])),
    runId: stringifyValue(pick(raw, ["runId", "run_id"])),
    exitCode: numberValue(pick(raw, ["exitCode", "exit_code"])),
    rerunStage: stringifyValue(pick(rerunScope, ["stage", "action"])),
    rerunFeatures: Array.isArray(rerunScope?.features) ? rerunScope.features.map(String) : undefined,
    rootCauseSummary: stringifyValue(pick(rootCause, ["failure_symptom", "failureSymptom", "direct_cause", "directCause", "summary"])),
    filesChangedCount: Array.isArray(raw.files_changed) ? raw.files_changed.length : undefined,
    pushed: typeof raw.pushed === "boolean" ? raw.pushed : undefined,
    at: formatDate(pick(raw, ["at", "createdAt", "created_at", "time"])),
    title: stringifyValue(pick(raw, ["title", "name"])) || undefined,
  };
}

function extractRecoveryRecords(data) {
  const candidates = [
    data.recoveryRecords,
    data.recoveries,
    data.recovery,
    data.pipeline?.recovery_history,
    data.pipeline?.recoveryRecords,
    data.pipeline?.recoveries,
    data.pipeline?.runtime_snapshot?.recovery_index,
    data.metadata?.recoveryRecords,
    data.meta?.recoveryRecords,
    ...findAllDeep(data, ["recoveryRecords", "recoveries"], 4),
  ];
  const records = [];
  for (const candidate of candidates) {
    for (const record of arrayFromMaybeMap(candidate)) records.push(normalizeRecoveryRecord(record, records.length));
  }
  const unique = [];
  const seen = new Set();
  for (const record of records.filter((item) => item.title || item.stage || item.message || item.count !== undefined)) {
    const key = JSON.stringify([record.stage || "", record.count ?? "", record.message || "", record.title || ""]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function extractRecoveryInfo(data) {
  const records = extractRecoveryRecords(data);
  const current = firstDefined(
    data.pipeline?.current_recovery,
    data.pipeline?.recovery_current,
    data.current_recovery,
    data.recovery?.current
  );
  const currentRecord = current ? normalizeRecoveryRecord(current, 0) : undefined;
  const stateSource = data.pipeline?.current || data.current || {};
  const currentState = lower(pick(stateSource, ["state", "status", "stage", "detail"]));
  const looksRecovering = currentState.includes("recover");
  return {
    historyCount: records.length,
    current: currentRecord,
    isRecovering: Boolean(currentRecord || looksRecovering),
    latest: records.length ? records[records.length - 1] : undefined,
    records,
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
    pipeline: extractPipelineInfo(data, stages, filePath),
    codegen: extractCodegenProgress(data, stages),
    recovery: extractRecoveryInfo(data),
    recoveryRecords: extractRecoveryRecords(data),
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
  lines.push("");
  lines.push("## 项目");
  if (summary.project.id) lines.push(`- 项目 ID: ${summary.project.id}`);
  lines.push(`- 项目名称: ${projectName}`);
  lines.push(`- 项目简介: ${projectBrief}`);
  if (summary.project.rootDir) lines.push(`- 根目录: ${summary.project.rootDir}`);
  if (summary.project.gitRemote) lines.push(`- Git remote: ${summary.project.gitRemote}`);
  if (summary.project.remoteUrl) lines.push(`- Remote URL: ${summary.project.remoteUrl}`);
  if (summary.project.defaultBranch) lines.push(`- 默认分支: ${summary.project.defaultBranch}`);
  if (summary.project.remoteConfiguredAt) lines.push(`- Remote 配置时间: ${summary.project.remoteConfiguredAt}`);
  if (summary.project.createdAt) lines.push(`- 开始时间: ${summary.project.createdAt}`);
  if (summary.project.updatedAt) lines.push(`- 最近更新时间: ${summary.project.updatedAt}`);
  lines.push("");
  lines.push("## 流水线");
  if (summary.pipeline.currentStage) lines.push(`- 当前阶段: ${summary.pipeline.currentStage}`);
  if (summary.pipeline.currentStatus) lines.push(`- 当前状态: ${summary.pipeline.currentStatus}`);
  if (summary.pipeline.detail) lines.push(`- 当前详情: ${summary.pipeline.detail}`);
  if (summary.pipeline.recentCompletedStage) lines.push(`- 最近完成阶段: ${summary.pipeline.recentCompletedStage}`);
  if (summary.pipeline.pid !== undefined) lines.push(`- 当前进程 PID: ${summary.pipeline.pid}`);
  if (summary.pipeline.currentStageStartedAt) lines.push(`- 当前阶段启动时间: ${summary.pipeline.currentStageStartedAt}`);
  if (summary.pipeline.heartbeatAt) lines.push(`- 最近心跳: ${summary.pipeline.heartbeatAt}`);
  if (summary.pipeline.elapsedMs !== undefined) lines.push(`- 当前阶段已运行: ${formatDuration(summary.pipeline.elapsedMs)}`);
  if (summary.pipeline.stagesUpdatedAt) lines.push(`- stages.json 更新时间: ${summary.pipeline.stagesUpdatedAt}`);
  if (summary.pipeline.globalLog || summary.pipeline.stageLog) {
    lines.push("- 日志:");
    if (summary.pipeline.globalLog) lines.push(`  - 全局: ${summary.pipeline.globalLog}`);
    if (summary.pipeline.stageLog) lines.push(`  - 阶段: ${summary.pipeline.stageLog}`);
  }
  lines.push(`- Stage 统计: 总计 ${summary.counts.totalStages}，已完成 ${summary.counts.completedStages}，运行中 ${summary.counts.runningStages}，失败 ${summary.counts.failedStages}，未开始/等待 ${summary.counts.pendingStages}`);
  lines.push(`- 子项/任务统计: 总计 ${summary.counts.totalTasks}，已完成 ${summary.counts.completedTasks}，运行中 ${summary.counts.runningTasks}，失败 ${summary.counts.failedTasks}，未完成 ${summary.counts.pendingTasks}`);
  lines.push(`- 已完成 stage 总计运行时间: ${formatDuration(summary.runtime.completedTotalMs)}`);
  lines.push(`- 失败次数: ${summary.failures}`);
  lines.push(`- Recovery 次数: ${summary.recoveries}`);
  lines.push("");
  lines.push("## 阶段状态");
  lines.push(listLine(summary.stages, (stage) => `- ${stage.name}: ${stage.status}`));
  if (summary.codegen) {
    lines.push("");
    lines.push("## Codegen 进度");
    lines.push(`- 已完成: ${summary.codegen.completedCount}`);
    lines.push(`- 运行中: ${summary.codegen.runningCount}`);
    lines.push(`- 待处理: ${summary.codegen.pendingCount}`);
    lines.push("");
    lines.push("### 运行中");
    lines.push(listLine(summary.codegen.running, (task) => {
      const parts = [`- ${taskFeatureId(task)}`];
      if (task.group) parts.push(`  - 分组: ${task.group}`);
      if (task.branch) parts.push(`  - 分支: ${task.branch}`);
      if (task.worktree) parts.push(`  - worktree: ${task.worktree}`);
      if (task.agent) parts.push(`  - agent: ${task.agent}`);
      return parts.join("\n");
    }));
    lines.push("");
    lines.push("### 已完成");
    lines.push(listLine(summary.codegen.completed, (task) => `- ${taskFeatureId(task)}`));
    lines.push("");
    lines.push("### 待处理");
    lines.push(listLine(summary.codegen.pending, (task) => `- ${taskFeatureId(task)}`));
  }
  if (summary.recovery.historyCount || summary.recovery.isRecovering) {
    lines.push("");
    lines.push("## Recovery 状态");
    lines.push(`- 是否正在 recovery: ${summary.recovery.isRecovering ? "是" : "否"}`);
    lines.push(`- 历史 recovery 次数: ${summary.recovery.historyCount}`);
    const currentRecovery = summary.recovery.current;
    if (currentRecovery) {
      lines.push(`- 当前 recovery stage: ${currentRecovery.stage || "未识别"}`);
      if (currentRecovery.attempt !== undefined) lines.push(`- 当前尝试次数: ${currentRecovery.attempt}`);
      if (currentRecovery.decision) lines.push(`- 决策: ${currentRecovery.decision}`);
      if (currentRecovery.repairTarget) lines.push(`- 修复目标: ${currentRecovery.repairTarget}`);
      if (currentRecovery.message) lines.push(`- 摘要: ${currentRecovery.message}`);
    }
    const latestRecovery = summary.recovery.latest;
    if (latestRecovery) {
      lines.push(`- 最近 recovery: ${latestRecovery.stage || "未识别"}${latestRecovery.attempt !== undefined ? ` attempt ${latestRecovery.attempt}` : ""}${latestRecovery.repairTarget ? `，目标 ${latestRecovery.repairTarget}` : ""}`);
      if (latestRecovery.rerunStage || latestRecovery.rerunFeatures?.length) {
        lines.push(`- 建议续跑: ${[latestRecovery.rerunStage, latestRecovery.rerunFeatures?.join(",")].filter(Boolean).join(" ")}`);
      }
    }
  }
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
  if (summary.recoveryRecords.length) {
    lines.push("");
    lines.push("## 恢复记录");
    lines.push(listLine(summary.recoveryRecords, (record) => {
      const countText = record.count !== undefined ? ` 修复 ${record.count} 次` : (record.attempt !== undefined ? ` attempt ${record.attempt}` : "");
      const prefix = record.stage ? `${record.stage}${countText}` : (record.title || "恢复记录");
      const meta = [record.repairTarget, record.category, record.decision].filter(Boolean).join("/");
      const suffix = [
        meta ? `(${meta})` : "",
        record.message ? `: ${record.message}` : "",
        record.rerunFeatures?.length ? `；续跑 ${record.rerunStage || record.stage}: ${record.rerunFeatures.join(",")}` : "",
      ].join("");
      return `- ${prefix}${suffix}`;
    }));
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
