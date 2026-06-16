#!/usr/bin/env node
import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const { mkdtemp, readFile, writeFile } = fs.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "export-req-md.mjs");
const root = await mkdtemp(path.join(os.tmpdir(), "req-maker-freeform-"));
const inputPath = path.join(root, "export.json");
const outputPath = path.join(root, "inputs", "req.md");

const exportDoc = {
  template_ref: "templates/req-template.md",
  project_name: {
    name_zh: "自由描述测试",
    name_en: "freeform-demo",
  },
  project_summary: "验证 freeform_content 渲染与来源规范化。",
  project_freeform_content: "用户希望生成一个能验证需求自由描述追溯的演示项目。",
  project_freeform_source: "user",
  agent: {
    agent_provider: "codex",
    agent_model: "gpt-5.5",
  },
  client_targets: [
    { target: "admin", positioning: "管理员后台" },
    { target: "backend", positioning: "服务端 API" },
  ],
  features: [{
    heading_client: "admin",
    heading_title: "查看自由描述",
    requirement_id: "REQ-001",
    item_id: "ITEM-001",
    source_item_id: "",
    version_number: 1,
    version_hash: "hash-feature-001",
    version_status: "draft",
    feature_id: "ADMIN-FREEFORM-001",
    structured_content: {
      priority: "must",
      phase: "mvp",
      client_targets: ["admin", "backend"],
      description: "管理员可以查看需求自由描述和来源标记。",
      user_stories: ["作为管理员，我希望查看自由描述，以便追溯需求来源。"],
      acceptance_criteria: ["页面展示 feature 的 freeform_content。"],
      dependencies: [],
    },
    structured_source: "user",
    freeform_content: "这个功能让管理员在后台确认每个功能的自然语言需求描述和来源。",
    freeform_source: "ai",
  }],
  test_cases: [{
    title: "查看自由描述",
    item_id: "TC-ITEM-001",
    source_item_id: "",
    version_number: 1,
    version_hash: "hash-test-001",
    version_status: "draft",
    structured_content: {
      feature_id: "ADMIN-FREEFORM-001",
      client_target: "admin",
      type: "smoke",
      priority: "must",
      preconditions: ["管理员已登录"],
      steps: ["打开需求详情页"],
      expected: ["可以看到 freeform_content"],
      test_data: [],
    },
    structured_source: "user",
    freeform_content: "验证管理员能看到自由描述字段。",
    freeform_source: "user",
  }],
  non_functional: {},
  deployment: { cloud_provider: "localhost", domain: "localhost" },
  auth: { scheme: "session", description: "管理员登录" },
  tech_constraints: {},
  other_notes: {},
};

await writeFile(inputPath, JSON.stringify(exportDoc, null, 2), "utf8");

const result = spawnSync(process.execPath, [
  scriptPath,
  "--input",
  inputPath,
  "--output",
  outputPath,
  "--json-report",
], {
  encoding: "utf8",
});

assert.equal(result.status, 0, result.stderr || result.stdout);
const markdown = await readFile(outputPath, "utf8");

assert.match(markdown, /## 核心功能 \*\n\nfreeform_source: from_user\nfreeform_content:\n用户希望生成一个能验证需求自由描述追溯的演示项目。/);
assert.match(markdown, /structured_source: user\nfreeform_source: from_ai\ndescription:\n管理员可以查看需求自由描述和来源标记。\n\nfreeform_content:\n这个功能让管理员在后台确认每个功能的自然语言需求描述和来源。/);
assert.match(markdown, /priority: must\nstructured_source: user\nfreeform_source: from_user\n\nfreeform_content:\n验证管理员能看到自由描述字段。/);

console.log("self-test-export-freeform: ok");
