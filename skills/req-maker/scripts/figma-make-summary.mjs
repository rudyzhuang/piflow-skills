#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { basename } from "node:path";

const [, , inputPath] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/figma-make-summary.mjs <file.make>");
  process.exit(2);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`${command} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr}` : "";
    throw new Error(`${command} exited with ${result.status}${stderr}`);
  }

  return result.stdout;
}

function unzipText(entryName) {
  return run("unzip", ["-p", inputPath, entryName]);
}

function unzipList() {
  return run("unzip", ["-l", inputPath]);
}

function parseJsonEntry(entryName) {
  const text = unzipText(entryName);
  return JSON.parse(text);
}

function parseContentJson(part) {
  if (!part?.contentJson) return null;
  try {
    return JSON.parse(part.contentJson);
  } catch {
    return null;
  }
}

function textFromPart(part) {
  const parsed = parseContentJson(part);
  if (!parsed) return "";
  if (typeof parsed.text === "string") return parsed.text;
  if (typeof parsed.title === "string") return parsed.title;
  if (typeof parsed.resultJson === "string") {
    try {
      const result = JSON.parse(parsed.resultJson);
      return typeof result.content === "string" ? result.content : "";
    } catch {
      return parsed.resultJson;
    }
  }
  return "";
}

function truncate(text, maxChars = 2400) {
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}\n...[truncated ${text.length - maxChars} chars]`;
}

function mdList(items) {
  if (!items.length) return "- 暂无";
  return items.map((item) => `- ${item}`).join("\n");
}

let archiveListing = "";
let meta = null;
let chat = null;

try {
  archiveListing = unzipList();
  meta = parseJsonEntry("meta.json");
  chat = parseJsonEntry("ai_chat.json");
} catch (error) {
  console.error(`Failed to read Figma Make bundle: ${error.message}`);
  process.exit(1);
}

const threads = Array.isArray(chat?.threads) ? chat.threads : [];
const thread = threads[0] ?? {};
const messages = Array.isArray(thread.messages) ? thread.messages : [];
const versions = Array.isArray(thread.makeVersions) ? thread.makeVersions : [];

const userMessages = messages
  .filter((message) => message.role === "user")
  .map((message) => {
    const parts = (message.parts ?? [])
      .filter((part) => part.partType === "text")
      .map(textFromPart)
      .filter(Boolean);
    return {
      index: message.index,
      createdAt: message.createdAt,
      text: parts.join("\n\n"),
    };
  })
  .filter((message) => message.text);

const assistantSummaries = messages
  .filter((message) => message.role === "assistant")
  .flatMap((message) =>
    (message.parts ?? [])
      .filter((part) => part.partType === "code-chat-assistant-text")
      .map(textFromPart)
      .filter(Boolean)
      .map((text) => ({
        index: message.index,
        createdAt: message.createdAt,
        text,
      })),
  );

const fileEntries = archiveListing
  .split("\n")
  .filter((line) => /\s(canvas\.fig|ai_chat\.json|meta\.json|thumbnail\.png|images\/)/.test(line.trim()))
  .map((line) => line.trim());

const canvas = meta?.client_meta?.render_coordinates;
const thumbnail = meta?.client_meta?.thumbnail_size;

console.log(`# Figma Make 本地文件解析摘要`);
console.log("");
console.log(`源文件: ${inputPath}`);
console.log(`文件名: ${meta?.file_name ?? basename(inputPath)}`);
console.log(`导出时间: ${meta?.exported_at ?? "未知"}`);
if (canvas) {
  console.log(`画布范围: x=${canvas.x}, y=${canvas.y}, width=${canvas.width}, height=${canvas.height}`);
}
if (thumbnail) {
  console.log(`缩略图尺寸: ${thumbnail.width}x${thumbnail.height}`);
}
console.log("");

console.log(`## 包内文件`);
console.log(mdList(fileEntries));
console.log("");

console.log(`## 版本历史`);
console.log(
  mdList(
    versions.map(
      (version) =>
        `v${version.versionNumber}: ${version.title ?? "未命名"} (seq=${version.sequenceNumber}, snapshot=${version.codeSnapshotKey ?? "无"})`,
    ),
  ),
);
console.log("");

console.log(`## 用户需求与变更记录`);
if (!userMessages.length) {
  console.log("- 暂无");
} else {
  for (const message of userMessages) {
    console.log(`### User #${message.index}${message.createdAt ? ` (${message.createdAt})` : ""}`);
    console.log(truncate(message.text, 5000));
    console.log("");
  }
}

console.log(`## Assistant 实现摘要`);
if (!assistantSummaries.length) {
  console.log("- 暂无");
} else {
  for (const summary of assistantSummaries) {
    console.log(`### Assistant #${summary.index}${summary.createdAt ? ` (${summary.createdAt})` : ""}`);
    console.log(truncate(summary.text, 3000));
    console.log("");
  }
}

console.log(`## 解析说明`);
console.log("- `.make` 文件是 zip-like 容器；`meta.json` 和 `ai_chat.json` 可直接用于需求提取。");
console.log("- `canvas.fig` 是 Figma Make 二进制画布数据；本脚本不解析完整图层树。");
console.log("- 若需要视觉细节，请结合 `thumbnail.png`、用户截图或可访问的普通 Figma `/design/...` 链接。");
