#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const installer = path.resolve(__dirname, '..', 'install.mjs');
const result = spawnSync(process.execPath, [installer, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`ERROR: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
