#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const opts = { cwd: process.cwd(), stage: "unknown-stage", topic: "repair-plan", force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") opts.cwd = argv[++i] || opts.cwd;
    else if (arg.startsWith("--cwd=")) opts.cwd = arg.slice("--cwd=".length);
    else if (arg === "--stage") opts.stage = argv[++i] || opts.stage;
    else if (arg.startsWith("--stage=")) opts.stage = arg.slice("--stage=".length);
    else if (arg === "--topic") opts.topic = argv[++i] || opts.topic;
    else if (arg.startsWith("--topic=")) opts.topic = arg.slice("--topic=".length);
    else if (arg === "--force") opts.force = true;
    else if (arg === "-h" || arg === "--help") opts.help = true;
  }
  return opts;
}

function usage() {
  return [
    "Usage: node scripts/recovery_plan_init.cjs --cwd <project-dir> --stage <stage> --topic <slug> [--force]",
    "",
    "Creates a recovery plan markdown skeleton under .codex/recovery-intercept/.",
  ].join("\n");
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  const projectDir = path.resolve(opts.cwd);
  const outDir = path.join(projectDir, ".codex", "recovery-intercept");
  ensureDir(outDir);

  const fileName = `${timestamp()}-${slug(opts.stage)}-${slug(opts.topic)}.md`;
  const outPath = path.join(outDir, fileName);
  if (fs.existsSync(outPath) && !opts.force) {
    console.error(`ERROR: file already exists: ${outPath}`);
    process.exit(1);
  }

  const content = [
    `# Recovery Plan: ${opts.stage} / ${opts.topic}`,
    "",
    "## 问题现象",
    "",
    "## 关键证据",
    "",
    "## 根因分析",
    "",
    "## 问题归属",
    "",
    "## 影响范围",
    "",
    "## 修复目标",
    "",
    "## 禁止伪修复说明",
    "",
    "## 具体修改点",
    "",
    "## 验证命令",
    "",
    "## 预期改善",
    "",
    "## 风险控制",
    "",
    "## 重启策略",
    "",
  ].join("\n");

  fs.writeFileSync(outPath, content, "utf8");
  console.log(outPath);
}

main();
