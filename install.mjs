#!/usr/bin/env node
// Install one or more local skills into AI coding agents.
//
// Dependency-free by design so it can run on macOS, Linux, and Windows with a
// stock Node.js installation.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_ROOT = path.join(REPO_ROOT, "skills");
const PLUGIN_MANIFEST = path.join(REPO_ROOT, ".codex-plugin", "plugin.json");
const SKIP_DIRS = new Set([".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"]);
const SKIP_FILES = new Set([".DS_Store"]);
const VALID_ONLY = new Set(["cursor", "codex", "opencode", "claude"]);
const CODEX_PERSONAL_MARKETPLACE_NAME = "personal";
const REQUIRED_SKILL_FILES = ["SKILL.md", "VERSION", "CHANGELOG.md", "README.md", "README.zh-CN.md", "install.mjs"];

function windowsEnvPath(name, ...parts) {
  const value = process.env[name];
  return value ? path.join(value, ...parts) : null;
}

function existingPaths(paths) {
  return paths.filter(Boolean);
}

function buildTargets(skillName) {
  const home = os.homedir();
  const isWindows = process.platform === "win32";
  const commandSuffix = isWindows ? ".cmd" : "";
  const opencodeConfigDir = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, "opencode")
    : path.join(home, ".config", "opencode");

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
      key: "opencode",
      label: "OpenCode",
      skillsDir: path.join(opencodeConfigDir, "skills"),
      commandNames: [`opencode${commandSuffix}`, "opencode"],
      markerPaths: existingPaths([
        opencodeConfigDir,
        windowsEnvPath("APPDATA", "opencode"),
        windowsEnvPath("LOCALAPPDATA", "opencode"),
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
    destination: path.join(target.skillsDir, skillName),
  }));
}

function pathExists(targetPath) {
  return fs.existsSync(targetPath);
}

function isExecutableFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
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

function copySkill(skillName, src, dst, dryRun) {
  if (isSameOrInside(src, dst)) {
    throw new Error(`Refusing to install into the source tree: ${dst}`);
  }

  if (dryRun) {
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = path.join(path.dirname(dst), `.${skillName}.tmp`);
  replaceExistingPath(tmp);
  copyRecursive(src, tmp);
  replaceExistingPath(dst);
  fs.renameSync(tmp, dst);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readPluginManifest() {
  if (!pathExists(PLUGIN_MANIFEST)) {
    return null;
  }
  const manifest = readJson(PLUGIN_MANIFEST);
  if (!manifest || typeof manifest !== "object" || typeof manifest.name !== "string" || !manifest.name.trim()) {
    throw new Error(`${PLUGIN_MANIFEST} must contain a non-empty string "name"`);
  }
  return manifest;
}

function buildCodexPluginPaths(pluginName) {
  const home = os.homedir();
  return {
    pluginDestination: path.join(home, "plugins", pluginName),
    marketplacePath: path.join(home, ".agents", "plugins", "marketplace.json"),
  };
}

function defaultMarketplace() {
  return {
    name: CODEX_PERSONAL_MARKETPLACE_NAME,
    interface: {
      displayName: "Personal",
    },
    plugins: [],
  };
}

function buildMarketplaceEntry(pluginName, category) {
  return {
    name: pluginName,
    source: {
      source: "local",
      path: `./plugins/${pluginName}`,
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category,
  };
}

function updateCodexMarketplace(manifest, marketplacePath, dryRun) {
  const pluginName = manifest.name;
  const category = manifest.interface?.category || "Productivity";
  const nextEntry = buildMarketplaceEntry(pluginName, category);

  if (dryRun) {
    return;
  }

  const marketplace = pathExists(marketplacePath) ? readJson(marketplacePath) : defaultMarketplace();
  if (!marketplace || typeof marketplace !== "object") {
    throw new Error(`${marketplacePath} must contain a JSON object`);
  }
  if (!marketplace.name) {
    marketplace.name = CODEX_PERSONAL_MARKETPLACE_NAME;
  }
  if (!marketplace.interface || typeof marketplace.interface !== "object") {
    marketplace.interface = { displayName: "Personal" };
  }
  if (!Array.isArray(marketplace.plugins)) {
    marketplace.plugins = [];
  }

  const existingIndex = marketplace.plugins.findIndex((entry) => entry?.name === pluginName);
  if (existingIndex >= 0) {
    marketplace.plugins[existingIndex] = nextEntry;
  } else {
    marketplace.plugins.push(nextEntry);
  }

  writeJson(marketplacePath, marketplace);
}

function runCodexPluginAdd(pluginName, dryRun) {
  const commandName = process.platform === "win32" ? "codex.cmd" : "codex";
  const codex = which(commandName) || which("codex");
  const spec = `${pluginName}@${CODEX_PERSONAL_MARKETPLACE_NAME}`;

  if (!codex) {
    console.log(`SKIP Codex plugin enable: codex command not found; marketplace entry was written for ${spec}`);
    return;
  }

  if (dryRun) {
    console.log(`WOULD RUN ${codex} plugin add ${spec}`);
    return;
  }

  const result = spawnSync(codex, ["plugin", "add", spec], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 30000,
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (result.status !== 0) {
    throw new Error(`codex plugin add ${spec} failed${output ? `:\n${output}` : ""}`);
  }
  if (output) {
    console.log(output);
  }
}

function installCodexPlugin(mode, dryRun) {
  const manifest = readPluginManifest();
  if (!manifest) {
    return 0;
  }

  const pluginName = manifest.name;
  const { pluginDestination, marketplacePath } = buildCodexPluginPaths(pluginName);
  const action = dryRun ? "WOULD INSTALL" : "INSTALL";

  console.log(`${action} plugin ${pluginName} -> Codex: ${pluginDestination} (${mode})`);
  installSkill(pluginName, REPO_ROOT, pluginDestination, mode, dryRun);
  console.log(`${action} marketplace entry ${pluginName} -> ${marketplacePath}`);
  updateCodexMarketplace(manifest, marketplacePath, dryRun);
  runCodexPluginAdd(pluginName, dryRun);
  return 1;
}

function installSkill(skillName, src, dst, mode, dryRun) {
  if (mode === "copy") {
    copySkill(skillName, src, dst, dryRun);
    return;
  }
  linkSkill(src, dst, dryRun);
}

function findSkills() {
  return fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(SKILLS_ROOT, name, "SKILL.md")))
    .sort();
}

function validateSkillName(name) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }

  const skillRoot = path.join(SKILLS_ROOT, name);
  const skillFile = path.join(skillRoot, "SKILL.md");
  if (!pathExists(skillFile)) {
    throw new Error(`Cannot find skill "${name}" at ${skillFile}`);
  }
  const missingFiles = REQUIRED_SKILL_FILES.filter((fileName) => !pathExists(path.join(skillRoot, fileName)));
  if (missingFiles.length > 0) {
    throw new Error(`Skill "${name}" is missing required file(s): ${missingFiles.join(", ")}`);
  }
  return { name, root: skillRoot };
}

function usage() {
  return [
    "Usage: node install.mjs [skill ...] [options]",
    "",
    "Examples:",
    "  node install.mjs                         install all skills in this directory",
    "  node install.mjs req-maker               install one skill",
    "  node install.mjs --skill commit-push      install one skill",
    "  node install.mjs --all-skills --copy      copy all skills instead of linking",
    "",
    "Options:",
    "  --all                 install to all known tool skill directories, even if the tool is not detected",
    "  --all-skills          install every directory that contains SKILL.md",
    "  --skill <name>        install the selected skill; may be provided multiple times",
    "  --only <tool>         install only to cursor, codex, opencode, or claude; may be provided multiple times",
    "  --dry-run             print what would be installed without writing files",
    "  --copy                copy files instead of creating symlinks",
    "  -h, --help            show this help",
    "",
    `Required skill files: ${REQUIRED_SKILL_FILES.join(", ")}`,
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    all: false,
    allSkills: false,
    skills: [],
    only: [],
    dryRun: false,
    copy: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") {
      args.all = true;
    } else if (arg === "--all-skills") {
      args.allSkills = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--copy") {
      args.copy = true;
    } else if (arg === "--skill") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--skill requires a skill name");
      }
      args.skills.push(value);
      index += 1;
    } else if (arg.startsWith("--skill=")) {
      args.skills.push(arg.slice("--skill=".length));
    } else if (arg === "--only") {
      const value = argv[index + 1];
      if (!value || !VALID_ONLY.has(value)) {
        throw new Error("--only requires one of: cursor, codex, opencode, claude");
      }
      args.only.push(value);
      index += 1;
    } else if (arg.startsWith("--only=")) {
      const value = arg.slice("--only=".length);
      if (!VALID_ONLY.has(value)) {
        throw new Error("--only requires one of: cursor, codex, opencode, claude");
      }
      args.only.push(value);
    } else if (arg === "-h" || arg === "--help") {
      console.log(usage());
      process.exit(0);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else {
      args.skills.push(arg);
    }
  }

  if (args.allSkills && args.skills.length > 0) {
    throw new Error("Use either explicit skill names or --all-skills, not both");
  }

  return args;
}

function selectedSkills(args) {
  const names = args.allSkills || args.skills.length === 0 ? findSkills() : args.skills;
  if (names.length === 0) {
    throw new Error(`No skills found under ${SKILLS_ROOT}`);
  }
  return names.map(validateSkillName);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const skills = selectedSkills(args);
  const selectedTargets = new Set(args.only);
  const mode = args.copy ? "copy" : "link";
  let installed = 0;
  let skipped = 0;

  console.log(`Source directory: ${REPO_ROOT}`);
  console.log(`Selected skills: ${skills.map((skill) => skill.name).join(", ")}`);

  for (const skill of skills) {
    for (const target of buildTargets(skill.name)) {
      if (selectedTargets.size > 0 && !selectedTargets.has(target.key)) {
        continue;
      }

      const { detected, reasons } = detectTarget(target);
      if (!detected && !args.all) {
        console.log(`SKIP ${skill.name} -> ${target.label}: not detected`);
        skipped += 1;
        continue;
      }

      const reasonText = reasons.length > 0 ? reasons.join(", ") : "--all";
      const action = args.dryRun ? "WOULD INSTALL" : "INSTALL";
      console.log(`${action} ${skill.name} -> ${target.label}: ${target.destination} (${mode}; ${reasonText})`);
      installSkill(skill.name, skill.root, target.destination, mode, args.dryRun);
      installed += 1;
    }
  }

  if (selectedTargets.size === 0 || selectedTargets.has("codex")) {
    installed += installCodexPlugin(mode, args.dryRun);
  }

  if (installed === 0) {
    console.log("No targets installed. Use --all to create all known tool skill directories.");
    return skipped > 0 ? 1 : 0;
  }

  if (args.dryRun) {
    console.log(`Dry run complete: ${installed} installation(s) matched.`);
  } else {
    console.log(`Done: installed ${skills.length} skill(s) to ${installed} target(s) using ${mode}.`);
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
