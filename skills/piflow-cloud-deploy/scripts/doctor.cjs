#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { providers, providerScore } = require('./providers/registry.cjs');
const { redact } = require('./redact.cjs');

function parseArgs(argv) {
  const args = { project: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === '--json') args.json = true;
    else if (raw.startsWith('--project=')) args.project = raw.slice('--project='.length);
    else if (raw === '--project' && argv[i + 1]) {
      args.project = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function buildReport(projectRoot) {
  const cloudDir = path.join(projectRoot, 'piflow_runtime', 'cloud');
  const cloudEnvPath = path.join(cloudDir, 'cloud.env');
  const deployJsonPath = path.join(cloudDir, 'deploy.json');
  const env = Object.assign({}, readEnvFile(cloudEnvPath), process.env);
  const providerRows = [...providers.values()].map((provider) => {
    const score = providerScore(provider, env);
    return {
      provider: provider.manifest.provider_id,
      score: score.score,
      capabilities: provider.manifest.capabilities,
      required_permissions: provider.manifest.required_permissions,
      matched_hints: score.matched,
      missing_hints: score.missing,
    };
  });
  return {
    project_root: projectRoot,
    cloud_dir: cloudDir,
    cloud_env_exists: fs.existsSync(cloudEnvPath),
    deploy_json_exists: fs.existsSync(deployJsonPath),
    providers: providerRows,
  };
}

function toMarkdown(report) {
  const lines = [
    '# PiFlow Cloud Deploy Doctor',
    '',
    `- 项目路径: ${report.project_root}`,
    `- cloud 目录: ${report.cloud_dir}`,
    `- cloud.env: ${report.cloud_env_exists ? '存在' : '不存在'}`,
    `- deploy.json: ${report.deploy_json_exists ? '存在' : '不存在'}`,
    '',
    '| provider | score | capabilities |',
    '| --- | ---: | --- |',
  ];
  for (const provider of report.providers) {
    lines.push(`| ${provider.provider} | ${provider.score} | ${provider.capabilities.join(', ')} |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = redact(buildReport(path.resolve(args.project)));
  if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(toMarkdown(report));
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs, readEnvFile, buildReport, toMarkdown };
