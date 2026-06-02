#!/usr/bin/env node
// Install this skill into local AI coding agents.
//
// The script is intentionally dependency-free so it can run on macOS, Linux,
// and Windows with a stock Node.js installation.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "commit-push";
const SKIP_DIRS = new Set([".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"]);
const SKIP_FILES = new Set([".DS_Store"]);
const VALID_ONLY = new Set(["cursor", "codex", "claude"]);

function homeDir() {
  return os.homedir();
}

function windowsEnvPath(name, ...parts) {
  const value = process.env[name];
  return value ? path.join(value, ...parts) : null;
}

function existingPaths(paths) {
  return paths.filter(Boolean);
}

function buildTargets() {
  const home = homeDir();
  const isWindows = process.platform === "win32";
  const commandSuffix = isWindows ? ".cmd" : "";

  return [
    {
      key: "cursor",
      label: "Cursor",
      skillsDir: path.join(home, ".cursor", "skills"),
      commandNames: [`cursor${commandSuffix}`, "cursor"],
      markerPaths: existingPaths([
        path.join(home, ".cursor"),
        "/Applications/Cursor.app",
        "/usr/share/applications/cursor.desktop",
        "/opt/Cursor",
        "/opt/cursor",
        windowsEnvPath("LOCALAPPDATA", "Programs", "Cursor", "Cursor.exe"),
        windowsEnvPath("LOCALAPPDATA", "Cursor"),
      ]),
    },
    {
      key: "codex",
      label: "Codex",
      skillsDir: path.join(home, ".codex", "skills"),
      commandNames: [`codex${commandSuffix}`, "codex"],
      markerPaths: existingPaths([
        path.join(home, ".codex"),
        windowsEnvPath("APPDATA", "Codex"),
        windowsEnvPath("LOCALAPPDATA", "Codex"),
      ]),
    },
    {
      key: "claude",
      label: "Claude Code",
      skillsDir: path.join(home, ".claude", "skills"),
      commandNames: [`claude${commandSuffix}`, "claude"],
      markerPaths: existingPaths([
        path.join(home, ".claude"),
        "/Applications/Claude.app",
        windowsEnvPath("LOCALAPPDATA", "AnthropicClaude"),
        windowsEnvPath("APPDATA", "Claude"),
      ]),
    },
  ].map((target) => ({
    ...target,
    destination: path.join(target.skillsDir, SKILL_NAME),
  }));
}

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function pathCandidates(commandName) {
  const pathValue = process.env.PATH || "";
  const pathExt = process.platform === "win32"
    ? (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];

  const hasExt = path.extname(commandName) !== "";
  const names = process.platform === "win32" && !hasExt
    ? pathExt.map((ext) => `${commandName}${ext.toLowerCase()}`)
    : [commandName];

  return pathValue
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((dir) => names.map((name) => path.join(dir, name)));
}

function which(commandName) {
  if (commandName.includes(path.sep)) {
    return isExecutableFile(commandName) ? commandName : null;
  }
  for (const candidate of pathCandidates(commandName)) {
    if (isExecutableFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function commandExists(commandNames) {
  return commandNames.some((name) => which(name));
}

function commandRuns(commandNames) {
  for (const name of commandNames) {
    const exe = which(name);
    if (!exe) {
      continue;
    }

    const result = spawnSync(exe, ["--version"], {
      encoding: "utf8",
      stdio: "ignore",
      timeout: 3000,
    });

    if (result.status === 0) {
      return true;
    }
  }
  return false;
}

function detectTarget(target) {
  const reasons = [];

  if (commandExists(target.commandNames)) {
    reasons.push("command found");
    if (commandRuns(target.commandNames)) {
      reasons[reasons.length - 1] = "command found and responds to --version";
    }
  }

  const existingMarker = target.markerPaths.find((markerPath) => pathExists(markerPath));
  if (existingMarker) {
    reasons.push(`marker exists: ${existingMarker}`);
  }

  return { detected: reasons.length > 0, reasons };
}

function sourceRoot() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const skillFile = path.join(root, "SKILL.md");
  if (!pathExists(skillFile)) {
    throw new Error(`Cannot find SKILL.md next to installer: ${skillFile}`);
  }
  return root;
}

function shouldSkip(targetPath) {
  const name = path.basename(targetPath);
  return SKIP_DIRS.has(name) || SKIP_FILES.has(name);
}

function isSameOrInside(source, destination) {
  const src = path.resolve(source);
  const dst = path.resolve(destination);
  const relative = path.relative(src, dst);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function replaceExistingPath(targetPath) {
  try {
    const stat = fs.lstatSync(targetPath);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

function linkSkill(src, dst, dryRun) {
  if (isSameOrInside(src, dst)) {
    throw new Error(`Refusing to install into the source tree: ${dst}`);
  }

  try {
    const stat = fs.lstatSync(dst);
    if (stat.isSymbolicLink()) {
      const resolved = fs.realpathSync(dst);
      if (path.resolve(resolved) === path.resolve(src)) {
        return;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (dryRun) {
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  replaceExistingPath(dst);
  const type = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(src, dst, type);
}

function copyRecursive(src, dst) {
  if (shouldSkip(src)) {
    return;
  }

  const stat = fs.lstatSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
    return;
  }

  if (stat.isSymbolicLink()) {
    const linkTarget = fs.readlinkSync(src);
    fs.symlinkSync(linkTarget, dst);
    return;
  }

  fs.copyFileSync(src, dst);
}

function copySkill(src, dst, dryRun) {
  if (isSameOrInside(src, dst)) {
    throw new Error(`Refusing to install into the source tree: ${dst}`);
  }

  if (dryRun) {
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = path.join(path.dirname(dst), `.${SKILL_NAME}.tmp`);
  replaceExistingPath(tmp);
  copyRecursive(src, tmp);
  replaceExistingPath(dst);
  fs.renameSync(tmp, dst);
}

function installSkill(src, dst, mode, dryRun) {
  if (mode === "copy") {
    copySkill(src, dst, dryRun);
    return;
  }
  linkSkill(src, dst, dryRun);
}

function usage() {
  return [
    "Usage: node install.mjs [--all] [--only cursor|codex|claude] [--dry-run] [--copy]",
    "",
    "Options:",
    "  --all                 install to all known skill directories, even if the tool is not detected",
    "  --only <tool>         install only to selected tool; may be provided multiple times",
    "  --dry-run             print what would be installed without writing files",
    "  --copy                copy files instead of creating symlinks",
    "  -h, --help            show this help",
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    all: false,
    only: [],
    dryRun: false,
    copy: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--copy") {
      args.copy = true;
    } else if (arg === "--only") {
      const value = argv[index + 1];
      if (!value || !VALID_ONLY.has(value)) {
        throw new Error("--only requires one of: cursor, codex, claude");
      }
      args.only.push(value);
      index += 1;
    } else if (arg.startsWith("--only=")) {
      const value = arg.slice("--only=".length);
      if (!VALID_ONLY.has(value)) {
        throw new Error("--only requires one of: cursor, codex, claude");
      }
      args.only.push(value);
    } else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const src = sourceRoot();
  const targets = buildTargets();
  const selected = new Set(args.only);
  const mode = args.copy ? "copy" : "link";
  let installed = 0;
  let skipped = 0;

  console.log(`Source skill: ${src}`);

  for (const target of targets) {
    if (selected.size > 0 && !selected.has(target.key)) {
      continue;
    }

    const { detected, reasons } = detectTarget(target);
    if (!detected && !args.all) {
      console.log(`SKIP ${target.label}: not detected`);
      skipped += 1;
      continue;
    }

    const reasonText = reasons.length > 0 ? reasons.join(", ") : "--all";
    const action = args.dryRun ? "WOULD INSTALL" : "INSTALL";
    console.log(`${action} ${target.label}: ${target.destination} (${mode}; ${reasonText})`);
    installSkill(src, target.destination, mode, args.dryRun);
    installed += 1;
  }

  if (installed === 0) {
    console.log("No targets installed. Use --all to create all known skill directories.");
    return skipped > 0 ? 1 : 0;
  }

  if (args.dryRun) {
    console.log(`Dry run complete: ${installed} target(s) matched.`);
  } else {
    console.log(`Done: installed ${SKILL_NAME} to ${installed} target(s) using ${mode}.`);
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
