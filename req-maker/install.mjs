#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const repoInstaller = path.resolve(skillDir, "..", "install.mjs");
const result = spawnSync(process.execPath, [repoInstaller, path.basename(skillDir), ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`ERROR: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
