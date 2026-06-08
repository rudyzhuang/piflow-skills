#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const COMPLETE = new Set(["complete", "completed", "success", "succeeded", "done", "passed", "ok", "finished"]);
const FAILED = new Set(["fail", "failed", "failure", "error", "errored", "crashed", "rejected"]);
const RUNNING = new Set(["running", "active", "in_progress", "in-progress", "processing", "executing", "started", "working"]);
const PENDING = new Set(["pending", "queued", "waiting", "todo", "not_started", "not-started", "created", "ready"]);
const PIPELINE_STEPS = [
  "setup",
  "prd",
  "prd-review",
  "design",
  "design-review",
  "codegen",
  "ui-scenarios",
  "code-review",
  "merge",
  "build",
  "deploy",
  "test",
  "report",
];
const STAGE_KEY_ALIASES = {
  "prd-review": "prd_review",
  "design-review": "design_review",
  "ui-scenarios": "ui_scenarios",
  "create-ui-scenarios": "ui_scenarios",
  create_ui_scenarios: "ui_scenarios",
  "code-review": "code_review",
};

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
  if (value === "blocked" || value === "stopped" || value === "skipped") return value;
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

function explicitDurationFromFields(obj) {
  if (!isPlainObject(obj)) return undefined;
  const msKeys = ["durationMs", "duration_ms", "elapsedMs", "elapsed_ms", "runtimeMs", "runtime_ms", "runTimeMs", "run_time_ms", "totalRuntimeMs", "total_runtime_ms", "executionTimeMs", "execution_time_ms", "timeMs", "time_ms"];
  const secKeys = ["durationSeconds", "duration_seconds", "elapsedSeconds", "elapsed_seconds", "runtimeSeconds", "runtime_seconds", "runTimeSeconds", "run_time_seconds", "seconds"];
  const minKeys = ["durationMinutes", "duration_minutes", "elapsedMinutes", "elapsed_minutes", "runtimeMinutes", "runtime_minutes", "minutes"];
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
  return undefined;
}

function durationFromFields(obj) {
  if (!isPlainObject(obj)) return undefined;
  const effective = effectiveDurationFromAttempts(obj);
  if (effective !== undefined) return effective;
  const explicit = explicitDurationFromFields(obj);
  if (explicit !== undefined) return explicit;
  const start = parseTime(pick(obj, ["startedAt", "startAt", "startTime", "started_at", "start_time", "createdAt"]));
  const end = parseTime(pick(obj, ["endedAt", "endAt", "endTime", "ended_at", "end_time", "finishedAt", "finished_at", "completedAt", "completed_at", "updatedAt", "updated_at"]));
  if (start && end && end >= start) return end - start;
  if (start) {
    const status = normalizeStatus(pick(obj, ["status", "state", "phase", "result"]));
    if (status === "running" || obj.running === true || obj.active === true) return Date.now() - start;
  }
  return undefined;
}

function effectiveDurationFromAttempts(obj) {
  if (!isPlainObject(obj)) return undefined;
  const histories = [
    obj.attempt_history,
    obj.attemptHistory,
    obj.attempts_history,
    obj.attemptsHistory,
    obj.runs,
    obj.executions,
  ];
  const attempts = histories.find(Array.isArray);
  if (!attempts || !attempts.length) return undefined;
  let total = 0;
  let seen = false;
  for (const attempt of attempts) {
    if (!isPlainObject(attempt)) continue;
    const status = normalizeStatus(pick(attempt, ["status", "state", "result"]));
    if (status === "failed" || status === "stopped" || status === "blocked") continue;
    const ms = explicitDurationFromFields(attempt) ?? durationFromFields({
      started_at: pick(attempt, ["startedAt", "started_at", "startTime", "start_time"]),
      completed_at: pick(attempt, ["completedAt", "completed_at", "endedAt", "ended_at", "finishedAt", "finished_at"]),
      status,
    });
    if (ms !== undefined) {
      total += ms;
      seen = true;
    }
  }
  return seen ? total : undefined;
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
    pick(raw, ["feature_id", "featureId", "scenario_id", "scenarioId", "client_target", "clientTarget", "service", "name", "title", "taskName", "label", "id", "key", "type"]),
    `任务 ${index + 1}`
  ));
}

function stageKey(name) {
  const raw = String(name || "").trim();
  const lowerName = raw.toLowerCase();
  return STAGE_KEY_ALIASES[lowerName] || lowerName.replace(/-/g, "_");
}

function displayStageName(name) {
  const key = stageKey(name);
  const found = PIPELINE_STEPS.find((step) => stageKey(step) === key);
  return found || String(name || key);
}

function taskStatusBucket(status) {
  if (status === "completed") return "completed";
  if (status === "running") return "running";
  if (status === "failed") return "failed";
  return "pending";
}

function gitValue(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || undefined;
  } catch (_) {
    return undefined;
  }
}

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return undefined;
  }
}

function loadProjectConfig(projectDir) {
  const candidates = [
    path.join(projectDir, "docs", "config.release.json"),
    path.join(projectDir, "docs", "config.dev.json"),
    path.join(projectDir, "docs", "config.json"),
  ];
  for (const file of candidates) {
    const config = readJsonIfExists(file);
    if (config) return config;
  }
  return {};
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

function namedTask(name, raw, status) {
  if (isPlainObject(raw)) return { key: name, name, ...raw, status: raw.status || raw.state || status };
  return { key: name, name, value: raw, status };
}

function tasksFromIds(ids, status) {
  return Array.isArray(ids) ? ids.map((id) => ({ feature_id: String(id), status })) : [];
}

function buildStageTasks(raw, name) {
  if (!isPlainObject(raw)) return [];
  const key = stageKey(name);
  const outputs = isPlainObject(raw.outputs) ? raw.outputs : {};
  const explicit = getTaskCollections(raw);
  const tasks = [];

  if (isPlainObject(raw.features)) {
    for (const [featureId, item] of Object.entries(raw.features)) tasks.push(namedTask(featureId, item, item?.status));
  }

  if (key === "prd") {
    tasks.push(...arrayFromMaybeMap(outputs.features).map((item) => isPlainObject(item) ? item : { feature_id: String(item) }));
  } else if (key === "prd_review") {
    if (isPlainObject(outputs.client_results)) {
      for (const [target, item] of Object.entries(outputs.client_results)) {
        const status = normalizeStatus(item?.status || item?.decision || outputs.decision);
        tasks.push(namedTask(target, item, status));
      }
    }
    tasks.push(...arrayFromMaybeMap(outputs.feature_assessments));
  } else if (key === "design") {
    tasks.push(...arrayFromMaybeMap(outputs.design_specs));
  } else if (key === "design_review") {
    tasks.push(...arrayFromMaybeMap(outputs.reviewed_features || outputs.feature_results));
  } else if (key === "codegen") {
    tasks.push(...tasksFromIds(outputs.completed_features, "completed"));
    tasks.push(...tasksFromIds(outputs.running_features, "running"));
    tasks.push(...tasksFromIds(outputs.failed_features, "failed"));
    tasks.push(...tasksFromIds(outputs.fail_fast_stopped_features, "stopped"));
    tasks.push(...tasksFromIds(outputs.pending_features, "pending"));
    tasks.push(...arrayFromMaybeMap(outputs.feature_artifacts).map((item) => ({ ...item, status: "completed" })));
  } else if (key === "ui_scenarios") {
    tasks.push(...arrayFromMaybeMap(outputs.scenarios || outputs.scenario_results || outputs.feature_scenarios));
  } else if (key === "code_review") {
    tasks.push(...tasksFromIds(outputs.completed_features || outputs.passed_features, "completed"));
    tasks.push(...tasksFromIds(outputs.failed_features, "failed"));
    tasks.push(...tasksFromIds(outputs.interrupted_features, "stopped"));
    tasks.push(...arrayFromMaybeMap(outputs.feature_reviews || outputs.review_results));
  } else if (key === "merge") {
    tasks.push(...arrayFromMaybeMap(outputs.merged_features || outputs.integrated_features).map((item) => isPlainObject(item) ? item : { feature_id: String(item), status: "completed" }));
    tasks.push(...arrayFromMaybeMap(outputs.failed_features).map((item) => isPlainObject(item) ? item : { feature_id: String(item), status: "failed" }));
  } else if (key === "build") {
    tasks.push(...arrayFromMaybeMap(outputs.services || outputs.targets || outputs.builds || outputs.artifacts));
  } else if (key === "deploy") {
    tasks.push(...arrayFromMaybeMap(outputs.services || outputs.deployments || outputs.deployment_urls || outputs.targets));
  } else if (key === "test") {
    tasks.push(...arrayFromMaybeMap(outputs.scenario_results || outputs.scenarios || outputs.failed_scenario_results));
    if (outputs.api_test) tasks.push({ name: "api_test", ...outputs.api_test });
  } else if (key === "report") {
    tasks.push(...arrayFromMaybeMap(outputs.reports || outputs.artifacts || outputs.files));
  } else if (key === "setup") {
    tasks.push(...arrayFromMaybeMap(outputs.client_targets).map((target) => ({ name: `client_target:${target}`, status: raw.status })));
    if (outputs.config_dev) tasks.push({ name: "config_dev", status: raw.status, output: outputs.config_dev });
    if (outputs.config_release) tasks.push({ name: "config_release", status: raw.status, output: outputs.config_release });
  }

  tasks.push(...explicit);
  if (!tasks.length && isPlainObject(raw.validation)) tasks.push({ name: "validation", status: raw.status, ...raw.validation });
  if (!tasks.length && isPlainObject(raw.git_sync)) tasks.push({ name: "git_sync", status: raw.status, ...raw.git_sync });

  const deduped = [];
  const seen = new Set();
  for (const task of tasks) {
    const normalized = normalizeTask(task, deduped.length);
    const dedupeKey = normalized.name;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    deduped.push(normalized);
  }
  return deduped;
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
    attempts: numberValue(pick(raw, ["attempts", "attempt", "attempts_used", "attemptsUsed", "retryCount", "retries", "runCount"])),
    failures: numberValue(pick(raw, ["failures", "failureCount", "failedCount", "errorCount", "hang_count", "hangCount"])),
    recoveryCount: numberValue(pick(raw, ["recoveryCount", "recoveries", "recoveryAttempts", "recoveredCount", "repairCount", "fix_attempts", "fixAttempts"])),
    group: stringifyValue(pick(raw, ["group", "groupId", "group_id"])),
    branch: stringifyValue(pick(raw, ["branch", "gitBranch", "featureBranch"])),
    worktree: stringifyValue(pick(raw, ["worktree", "worktreePath", "worktree_path"])),
    agent: stringifyValue(pick(raw, ["agent", "agentId", "agent_id", "agentName", "worker"])),
    error: stringifyValue(pick(raw, ["error", "reason", "message", "failure_summary"])),
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
  const name = stageName(raw, index);
  const tasks = buildStageTasks(raw, name);
  let status = normalizeStatus(pick(raw, ["status", "state", "phase", "result"]));
  if (status === "unknown") {
    if (raw.completed === true || raw.done === true || raw.success === true) status = "completed";
    else if (raw.failed === true || raw.error) status = "failed";
    else if (raw.running === true || raw.active === true) status = "running";
    else if (raw.completed === false || raw.done === false) status = "pending";
  }
  return {
    name,
    key: stageKey(name),
    displayName: displayStageName(name),
    status,
    durationMs: explicitDurationFromFields(raw) ?? explicitDurationFromFields(raw.outputs) ?? durationFromFields(raw),
    startedAt: formatDate(pick(raw, ["startedAt", "startAt", "startTime", "started_at", "start_time"])),
    endedAt: formatDate(pick(raw, ["endedAt", "endAt", "endTime", "ended_at", "end_time", "finishedAt", "completedAt"])),
    attempts: numberValue(pick(raw, ["attempts", "attempt", "attempts_used", "attemptsUsed", "retryCount", "retries", "runCount"])),
    failures: countFailures(raw, tasks),
    recoveryCount: countRecovery(raw, tasks),
    tasks,
    rawOutputs: isPlainObject(raw.outputs) ? raw.outputs : undefined,
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

function extractProjectInfo(data, projectDir) {
  const sources = [data.project, data.projectInfo, data.pipeline?.project, data.metadata, data.meta, data.summary, data.req, data.request, data];
  const gitSources = [data.git, data.remote, data.repository, data.repo, data.project?.git, data.projectInfo?.git, data.pipeline?.project?.git, data.metadata?.git, data.meta?.git, data];
  const name = firstDefined(...sources.map((source) => pick(source, ["projectName", "name", "title", "appName"])));
  const description = firstDefined(...sources.map((source) => pick(source, ["description", "brief", "summary", "intro", "prompt", "goal"])));
  const createdAt = firstDefined(...sources.map((source) => pick(source, ["createdAt", "startedAt", "startTime"])));
  const updatedAt = firstDefined(...sources.map((source) => pick(source, ["updatedAt", "lastUpdatedAt", "modifiedAt", "endedAt"])));
  const gitRoot = gitValue(projectDir, ["rev-parse", "--show-toplevel"]);
  const remoteName = stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["remote", "remoteName", "remote_name", "gitRemote"])))) || "origin";
  return {
    id: stringifyValue(firstDefined(...sources.map((source) => pick(source, ["projectId", "project_id", "id"])), findFirstDeep(data, ["projectId", "project_id"]))),
    name: name ? String(name) : undefined,
    description: description ? String(description) : undefined,
    rootDir: stringifyValue(firstDefined(...sources.map((source) => pick(source, ["rootDir", "root_dir", "rootPath", "root_path", "projectRoot", "project_root", "root", "cwd", "workspace"])), findFirstDeep(data, ["rootDir", "rootPath", "root_path", "projectRoot", "project_root"]), projectDir)),
    localRepo: gitRoot || (fs.existsSync(path.join(projectDir, ".git")) ? projectDir : undefined),
    gitRemote: remoteName,
    remoteUrl: stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["remoteUrl", "remote_url", "url", "gitUrl"])), gitValue(projectDir, ["remote", "get-url", remoteName]))),
    defaultBranch: stringifyValue(firstDefined(...gitSources.map((source) => pick(source, ["defaultBranch", "default_branch", "branch", "mainBranch"])), gitValue(projectDir, ["branch", "--show-current"]))),
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
    featureId: stringifyValue(pick(raw, ["featureId", "feature_id"])),
    failedFeatures: Array.isArray(raw.failed_features) ? raw.failed_features.map(String) : undefined,
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
    const key = JSON.stringify([
      record.stage || "",
      record.count ?? "",
      record.attempt ?? "",
      record.decision || "",
      record.repairTarget || "",
      record.featureId || "",
      Array.isArray(record.failedFeatures) ? record.failedFeatures.join(",") : "",
      record.message || "",
      record.title || "",
      record.at || "",
    ]);
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

function recoveryRecordMatchesTask(record, stage, task) {
  const stageMatch = !record.stage || stageKey(record.stage) === stage.key;
  if (!stageMatch) return false;
  if (record.featureId === task.name) return true;
  if (Array.isArray(record.failedFeatures) && record.failedFeatures.includes(task.name)) return true;
  const raw = [
    record.repairTarget,
    record.featureId,
    record.failedFeatures?.join(","),
    record.message,
    record.title,
    record.rerunFeatures?.join(","),
    record.failureSignatureId,
  ].filter(Boolean).join(" ");
  if (Array.isArray(record.rerunFeatures) && record.rerunFeatures.includes(task.name)) return true;
  return raw.includes(task.name);
}

function isRepairRecovery(record) {
  const decision = lower(record.decision);
  if (!decision) return false;
  if (decision.includes("retry") || decision === "invalid" || decision === "none") return false;
  return decision.includes("fix") || decision.includes("repair") || decision.includes("patched");
}

function enrichTask(task, stage, recoveryRecords) {
  const attempts = task.attempts ?? 0;
  const matchingRecoveries = recoveryRecords.filter((record) => isRepairRecovery(record) && recoveryRecordMatchesTask(record, stage, task));
  return {
    ...task,
    retryCount: Math.max(0, attempts - 1),
    repairCount: (task.recoveryCount || 0) + matchingRecoveries.length,
  };
}

function enrichStageTasks(stages, recoveryRecords) {
  for (const stage of stages) {
    stage.tasks = stage.tasks.map((task) => enrichTask(task, stage, recoveryRecords));
  }
}

function stageByKey(stages) {
  const map = new Map();
  for (const stage of stages) map.set(stage.key || stageKey(stage.name), stage);
  return map;
}

function stageStatusLabel(stage) {
  if (!stage || stage.status === "pending" || stage.status === "unknown") return "未开始";
  if (stage.status === "completed") return "已完成";
  if (stage.status === "running") return "运行中";
  if (stage.status === "failed") return "失败";
  if (stage.status === "blocked") return "阻塞";
  if (stage.status === "stopped") return "已停止";
  if (stage.status === "skipped") return "已跳过";
  return stage.status;
}

function currentRunSummary(pipeline, stages) {
  const currentKey = stageKey(pipeline.currentStage || stages.find((stage) => stage.status === "running")?.name || "");
  const currentStage = stages.find((stage) => (stage.key || stageKey(stage.name)) === currentKey) || stages.find((stage) => stage.status === "running");
  if (!currentStage) return undefined;
  const tasks = flattenTasks(currentStage.tasks);
  const completedTasks = tasks.filter((task) => taskStatusBucket(task.status) === "completed");
  const runningTasks = tasks.filter((task) => taskStatusBucket(task.status) === "running");
  const failedTasks = tasks.filter((task) => taskStatusBucket(task.status) === "failed");
  const pendingTasks = tasks.filter((task) => taskStatusBucket(task.status) === "pending");
  const total = tasks.length || 1;
  const completed = tasks.length ? completedTasks.length : (currentStage.status === "completed" ? 1 : 0);
  return {
    stage: currentStage.displayName || currentStage.name,
    status: pipeline.currentStatus || currentStage.status,
    progress: { completed, total },
    stageDurationMs: pipeline.elapsedMs ?? currentStage.durationMs,
    completedTasks,
    runningTasks,
    failedTasks,
    pendingTasks,
  };
}

function futureStageSummary(currentStageName, stages) {
  const currentIndex = PIPELINE_STEPS.findIndex((step) => stageKey(step) === stageKey(currentStageName));
  const start = currentIndex >= 0 ? currentIndex + 1 : 0;
  const map = stageByKey(stages);
  return PIPELINE_STEPS.slice(start).map((step) => {
    const stage = map.get(stageKey(step));
    return {
      name: step,
      status: stage?.status || "pending",
      statusLabel: stageStatusLabel(stage),
      durationMs: stage?.durationMs,
    };
  });
}

function getStage(stages, key) {
  return stages.find((stage) => (stage.key || stageKey(stage.name)) === stageKey(key));
}

function pushUnique(list, value) {
  const str = stringifyValue(value);
  if (!str || list.includes(str)) return;
  list.push(str);
}

function collectFeatureIds(stages, preference = "all") {
  const ids = [];
  const prd = getStage(stages, "prd");
  const design = getStage(stages, "design");
  const designReview = getStage(stages, "design_review");
  const codegen = getStage(stages, "codegen");

  for (const task of prd?.tasks || []) pushUnique(ids, task.name);
  for (const task of design?.tasks || []) pushUnique(ids, task.name);
  for (const task of designReview?.tasks || []) {
    if (preference !== "codegen_ready" || task.can_enter_codegen === true || task.status === "completed") pushUnique(ids, task.name);
  }
  for (const task of codegen?.tasks || []) {
    if (preference === "codegen_completed" && task.status !== "completed") continue;
    pushUnique(ids, task.name);
  }
  return ids;
}

function collectClientTargets(stages) {
  const targets = [];
  for (const stageName of ["setup", "prd"]) {
    const stage = getStage(stages, stageName);
    const outputs = stage && isPlainObject(stage.rawOutputs) ? stage.rawOutputs : {};
    for (const target of arrayFromMaybeMap(outputs.client_targets)) {
      if (isPlainObject(target)) pushUnique(targets, target.name || target.key || target.value);
      else pushUnique(targets, target);
    }
  }
  return targets;
}

function collectScenarioIds(stages) {
  const ids = [];
  const ui = getStage(stages, "ui_scenarios");
  for (const task of ui?.tasks || []) pushUnique(ids, task.name);
  return ids;
}

function configBuildTargets(config) {
  const build = isPlainObject(config.build) ? config.build : {};
  const targets = [];
  for (const target of arrayFromMaybeMap(build.client_targets)) {
    if (isPlainObject(target)) pushUnique(targets, target.name || target.key || target.value);
    else pushUnique(targets, target);
  }
  if (!targets.length && isPlainObject(build.commands)) {
    for (const key of Object.keys(build.commands)) {
      if (key === "build" || key === "install") continue;
      pushUnique(targets, key);
    }
  }
  return targets;
}

function configDeployServices(config) {
  const deploy = isPlainObject(config.deploy) ? config.deploy : {};
  const services = [];
  for (const service of arrayFromMaybeMap(deploy.services)) {
    if (isPlainObject(service)) pushUnique(services, service.name || service.client_target || service.role || service.key);
    else pushUnique(services, service);
  }
  return services;
}

function configSmokeChecks(config) {
  const smoke = isPlainObject(config.smoke) ? config.smoke : {};
  const checks = [];
  for (const [index, check] of arrayFromMaybeMap(smoke.checks).entries()) {
    if (isPlainObject(check)) pushUnique(checks, check.name || check.id || check.url || `smoke-${index + 1}`);
    else pushUnique(checks, check);
  }
  return checks;
}

function fallbackTasksForStage(stage, stages, config) {
  const key = stage.key || stageKey(stage.name);
  let ids = [];
  if (key === "prd_review") ids = collectClientTargets(stages);
  else if (key === "design") ids = collectFeatureIds(stages);
  else if (key === "design_review") ids = collectFeatureIds(stages);
  else if (key === "codegen") ids = collectFeatureIds(stages, "codegen_ready");
  else if (key === "ui_scenarios") ids = collectFeatureIds(stages, "codegen_ready");
  else if (key === "code_review") ids = collectFeatureIds(stages, "codegen_completed");
  else if (key === "merge") ids = collectFeatureIds(stages, "codegen_completed");
  else if (key === "build") ids = configBuildTargets(config);
  else if (key === "deploy") ids = configDeployServices(config);
  else if (key === "test") ids = collectScenarioIds(stages).concat(configSmokeChecks(config));
  else if (key === "report") ids = ["pipeline-report"];
  if (!ids.length && (key === "build" || key === "deploy")) ids = collectClientTargets(stages);
  return ids.map((id, index) => normalizeTask({ feature_id: id, status: "pending" }, index));
}

function applyDerivedTaskDefinitions(stages, config) {
  for (const stage of stages) {
    if (stage.tasks && stage.tasks.length) continue;
    stage.tasks = fallbackTasksForStage(stage, stages, config);
  }
}

function ensurePipelineStages(data, stages) {
  const existing = stageByKey(stages);
  const current = stringifyValue(firstDefined(
    data.pipeline?.current_stage,
    data.pipeline?.currentStage,
    data.pipeline?.current?.stage,
    data.current_stage,
    data.currentStage
  ));
  const currentStatus = normalizeStatus(firstDefined(
    data.pipeline?.status,
    data.pipeline?.current_status,
    data.pipeline?.current?.status,
    data.pipeline?.current?.state,
    data.status
  ));
  for (const step of PIPELINE_STEPS) {
    const key = stageKey(step);
    if (existing.has(key)) continue;
    const status = current && stageKey(current) === key && currentStatus !== "unknown" ? currentStatus : "pending";
    const stage = {
      name: key,
      key,
      displayName: step,
      status,
      durationMs: undefined,
      failures: 0,
      recoveryCount: 0,
      tasks: [],
      output: undefined,
    };
    stages.push(stage);
    existing.set(key, stage);
  }
  stages.sort((a, b) => {
    const ai = PIPELINE_STEPS.findIndex((step) => stageKey(step) === (a.key || stageKey(a.name)));
    const bi = PIPELINE_STEPS.findIndex((step) => stageKey(step) === (b.key || stageKey(b.name)));
    return (ai === -1 ? Number.MAX_SAFE_INTEGER : ai) - (bi === -1 ? Number.MAX_SAFE_INTEGER : bi);
  });
}

function summarize(data, filePath, projectDir) {
  const stages = findStageCollection(data).map(normalizeStage);
  ensurePipelineStages(data, stages);
  applyDerivedTaskDefinitions(stages, loadProjectConfig(projectDir));
  const recoveryRecords = extractRecoveryRecords(data);
  enrichStageTasks(stages, recoveryRecords);
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
    project: extractProjectInfo(data, projectDir),
    pipeline: extractPipelineInfo(data, stages, filePath),
    codegen: extractCodegenProgress(data, stages),
    recovery: extractRecoveryInfo(data),
    recoveryRecords,
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
    currentRun: currentRunSummary(extractPipelineInfo(data, stages, filePath), stages),
    futureStages: futureStageSummary(extractPipelineInfo(data, stages, filePath).currentStage, stages),
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

function renderTaskLine(task) {
  const meta = [
    `修复 ${task.repairCount || 0} 次`,
    `重试 ${task.retryCount || 0} 次`,
    `有效执行 ${formatDuration(task.durationMs)}`,
  ];
  const extra = [];
  if (task.group) extra.push(`分组 ${task.group}`);
  if (task.branch) extra.push(`分支 ${task.branch}`);
  if (task.worktree) extra.push(`worktree ${task.worktree}`);
  if (task.agent) extra.push(`agent ${task.agent}`);
  if (task.error) extra.push(`原因 ${task.error}`);
  return `- ${task.name}（${meta.join("，")}）${extra.length ? `；${extra.join("；")}` : ""}`;
}

function renderDetailedTasks(title, tasks) {
  return [
    `### ${title}`,
    listLine(tasks, renderTaskLine),
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
  lines.push("## 项目介绍");
  if (summary.project.id) lines.push(`- 项目 ID: ${summary.project.id}`);
  lines.push(`- 项目名称: ${projectName}`);
  lines.push(`- 项目简介: ${projectBrief}`);
  if (summary.project.rootDir) lines.push(`- 项目路径: ${summary.project.rootDir}`);
  if (summary.project.localRepo) lines.push(`- Git 本地仓库: ${summary.project.localRepo}`);
  if (summary.project.gitRemote) lines.push(`- Git remote: ${summary.project.gitRemote}`);
  if (summary.project.remoteUrl) lines.push(`- Remote URL: ${summary.project.remoteUrl}`);
  if (summary.project.defaultBranch) lines.push(`- 默认分支: ${summary.project.defaultBranch}`);
  if (summary.project.remoteConfiguredAt) lines.push(`- Remote 配置时间: ${summary.project.remoteConfiguredAt}`);
  if (summary.project.createdAt) lines.push(`- 开始时间: ${summary.project.createdAt}`);
  if (summary.project.updatedAt) lines.push(`- 最近更新时间: ${summary.project.updatedAt}`);
  lines.push("");
  lines.push("## 当前运行");
  if (summary.currentRun) {
    lines.push(`- 流水线阶段: ${summary.currentRun.stage}`);
    lines.push(`- 状态: ${summary.currentRun.status}`);
    lines.push(`- 进度: ${summary.currentRun.progress.completed} / ${summary.currentRun.progress.total}`);
    lines.push(`- 当前 stage 有效运行时间: ${formatDuration(summary.currentRun.stageDurationMs)}`);
    lines.push("");
    lines.push(renderDetailedTasks("已完成", summary.currentRun.completedTasks));
    lines.push("");
    lines.push(renderDetailedTasks("运行中", summary.currentRun.runningTasks));
    lines.push("");
    lines.push(renderDetailedTasks("待处理", summary.currentRun.pendingTasks));
    if (summary.currentRun.failedTasks.length) {
      lines.push("");
      lines.push(renderDetailedTasks("失败/阻塞", summary.currentRun.failedTasks));
    }
  } else {
    lines.push("- 未识别当前运行 stage");
  }
  lines.push("");
  lines.push("## 后续阶段");
  lines.push(listLine(summary.futureStages, (stage) => `- ${stage.name}: ${stage.statusLabel} / 已执行累计时间 ${formatDuration(stage.durationMs)}`));
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
  const summary = summarize(data, filePath, cwd);
  const result = { ok: true, ...summary };
  if (opts.json) console.log(JSON.stringify(result, null, 2));
  else console.log(renderReport(summary));
}

main();
