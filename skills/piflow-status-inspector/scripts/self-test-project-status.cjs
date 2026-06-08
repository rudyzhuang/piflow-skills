#!/usr/bin/env node
"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const skillDir = path.resolve(__dirname, "..");
const script = path.join(skillDir, "scripts", "project_status.cjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "piflow-status-"));
const outDir = path.join(tmp, "output-stages");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(tmp, ".git"), { recursive: true });
fs.writeFileSync(path.join(tmp, ".git", "HEAD"), "ref: refs/heads/main\n");

const stages = {
  project: {
    id: "proj-123",
    name: "demo",
  },
  pipeline: {
    current_stage: "codegen",
    status: "running",
    recovery_history: [
      { stage: "codegen", repair_target: "feature", feature_id: "AUTH-LOGIN-001", decision: "retry_only" },
      { stage: "codegen", repair_target: "feature", failed_features: ["AUTH-LOGIN-001"], decision: "fix" },
    ],
  },
  stages: {
    setup: {
      status: "completed",
      started_at: "2026-06-08 08:00:00 +0800",
      completed_at: "2026-06-08 08:01:00 +0800",
      outputs: {
        client_targets: ["admin", "backend"],
      },
    },
    prd: {
      status: "completed",
      outputs: {
        features: [
          { feature_id: "AUTH-LOGIN-001", name: "login" },
          { feature_id: "BACKEND-HEALTH-001", name: "health" },
        ],
      },
    },
    codegen: {
      status: "running",
      started_at: "2026-06-08 08:10:00 +0800",
      features: {
        "AUTH-LOGIN-001": {
          status: "running",
          started_at: "2026-06-08 08:20:00 +0800",
          attempts_used: 3,
          attempt_history: [
            {
              status: "failed",
              started_at: "2026-06-08 08:10:00 +0800",
              completed_at: "2026-06-08 08:18:00 +0800",
              duration_ms: 480000,
            },
            {
              status: "running",
              started_at: "2026-06-08 08:20:00 +0800",
              duration_ms: 120000,
            },
          ],
          group_id: "group-a",
          branch: "features/pif-AUTH-LOGIN-001",
          worktree_path: "output-stages/codegen/worktrees/pif-AUTH-LOGIN-001",
        },
        "BACKEND-HEALTH-001": {
          status: "completed",
          started_at: "2026-06-08 08:12:00 +0800",
          completed_at: "2026-06-08 08:15:00 +0800",
          attempts_used: 1,
        },
        "DEVICE-MGMT-001": {
          status: "pending",
          attempts_used: 0,
        },
      },
    },
  },
};

fs.writeFileSync(path.join(outDir, "stages.json"), JSON.stringify(stages, null, 2));

const result = spawnSync(process.execPath, [script, "--cwd", tmp, "--json"], { encoding: "utf8" });
assert.strictEqual(result.status, 0, result.stderr);
const summary = JSON.parse(result.stdout);

assert.strictEqual(summary.project.rootDir, tmp);
assert.strictEqual(summary.project.localRepo, tmp);
assert.strictEqual(summary.currentRun.stage, "codegen");
assert.strictEqual(summary.currentRun.progress.completed, 1);
assert.strictEqual(summary.currentRun.progress.total, 3);
assert(summary.currentRun.completedTasks.some((task) => task.name === "BACKEND-HEALTH-001" && task.retryCount === 0));
const auth = summary.currentRun.runningTasks.find((task) => task.name === "AUTH-LOGIN-001");
assert(auth, "AUTH-LOGIN-001 should be running");
assert.strictEqual(auth.retryCount, 2);
assert.strictEqual(auth.repairCount, 1);
assert.strictEqual(auth.durationMs, 120000);
assert(summary.futureStages.some((stage) => stage.name === "ui-scenarios" && stage.statusLabel === "未开始"));

const text = spawnSync(process.execPath, [script, "--cwd", tmp], { encoding: "utf8" });
assert.strictEqual(text.status, 0, text.stderr);
assert(text.stdout.includes("## 项目介绍"));
assert(text.stdout.includes("- 进度: 1 / 3"));
assert(text.stdout.includes("## 后续阶段"));

const codeReviewTmp = fs.mkdtempSync(path.join(os.tmpdir(), "piflow-status-code-review-"));
const codeReviewOutDir = path.join(codeReviewTmp, "output-stages");
fs.mkdirSync(codeReviewOutDir, { recursive: true });
const codeReviewStages = {
  project: { id: "proj-456", name: "review-demo" },
  pipeline: { current_stage: "code-review", status: "running" },
  stages: {
    prd: {
      status: "completed",
      outputs: {
        client_targets: ["admin", "backend"],
        features: [
          { feature_id: "AUTH-LOGIN-001", name: "login" },
          { feature_id: "BACKEND-HEALTH-001", name: "health" },
        ],
      },
    },
    codegen: {
      status: "completed",
      outputs: {
        feature_artifacts: [
          { feature_id: "AUTH-LOGIN-001", status: "completed", duration_ms: 200000 },
          { feature_id: "BACKEND-HEALTH-001", status: "completed", duration_ms: 100000 },
        ],
      },
    },
    code_review: {
      status: "running",
      started_at: "2026-06-08 09:00:00 +0800",
      features: {},
      outputs: {},
    },
  },
};
fs.writeFileSync(path.join(codeReviewOutDir, "stages.json"), JSON.stringify(codeReviewStages, null, 2));
const codeReviewResult = spawnSync(process.execPath, [script, "--cwd", codeReviewTmp, "--json"], { encoding: "utf8" });
assert.strictEqual(codeReviewResult.status, 0, codeReviewResult.stderr);
const codeReviewSummary = JSON.parse(codeReviewResult.stdout);
assert.strictEqual(codeReviewSummary.currentRun.stage, "code-review");
assert.strictEqual(codeReviewSummary.currentRun.progress.total, 2);
assert.deepStrictEqual(
  codeReviewSummary.currentRun.pendingTasks.map((task) => task.name).sort(),
  ["AUTH-LOGIN-001", "BACKEND-HEALTH-001"]
);

console.log("self-test-project-status: ok");
