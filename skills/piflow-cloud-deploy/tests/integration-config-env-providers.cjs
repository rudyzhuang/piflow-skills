#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { dispatch } = require('../scripts/cloud_deploy.cjs');
const { providers, providerScore } = require('../scripts/providers/registry.cjs');

const DEFAULT_PIFLOW_CONFIG_ENV = '/Users/guodongzhuang/github/piflow/config.env';

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function completeProviders(env) {
  return [...providers.values()]
    .filter(provider => !['manual', 'mock'].includes(provider.manifest.provider_id))
    .filter(provider => providerScore(provider, env).score > 0)
    .filter(provider => {
      const hints = provider.manifest.credential_hints || [];
      return hints.some(group => group.every(key => env[key] && String(env[key]).trim()));
    })
    .map(provider => provider.manifest.provider_id)
    .sort();
}

function envKeyForProvider(provider) {
  return String(provider || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function realDeployEnabled(env = process.env) {
  return env.PIFLOW_CLOUD_DEPLOY_REAL === '1' || env.PIFLOW_CLOUD_DEPLOY_REAL === 'true';
}

function realDeployCommand(provider, env = process.env) {
  const providerKey = envKeyForProvider(provider);
  return env[`PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_${providerKey}`] || env.PIFLOW_CLOUD_DEPLOY_REAL_COMMAND || '';
}

function fixtureDeploy(provider, command = '') {
  const common = { provider };
  if (command) {
    const providerCfg = {};
    providerCfg[provider] = { commands: [command] };
    return Object.assign(common, providerCfg, {
      services: [{ name: 'real-command', type: 'custom', url: 'https://example.com' }],
    });
  }
  if (provider === 'cloudflare') {
    return Object.assign(common, {
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        cloudflare: { project_name: 'piflow-integration-dry-run' },
      }],
    });
  }
  if (provider === 'aws') {
    return Object.assign(common, {
      services: [{ name: 'web', type: 'static_site', artifact_path: 'dist/web', aws: { bucket: 'piflow-integration-dry-run' } }],
    });
  }
  if (provider === 'gcp') {
    return Object.assign(common, {
      services: [{ name: 'api', type: 'cloud_run', gcp: { service: 'piflow-integration-dry-run', image: 'example.com/piflow/demo:latest' } }],
    });
  }
  if (provider === 'tencent') {
    return Object.assign(common, {
      services: [{ name: 'web', type: 'static_site', artifact_path: 'dist/web', tencent: { bucket: 'piflow-integration-dry-run' } }],
    });
  }
  if (provider === 'aliyun') {
    return Object.assign(common, {
      services: [{ name: 'web', type: 'static_site', artifact_path: 'dist/web', aliyun: { bucket: 'piflow-integration-dry-run' } }],
    });
  }
  if (provider === 'custom') {
    return Object.assign(common, {
      custom: {
        commands: [`${process.execPath} -e "process.stdout.write('custom dry run')"`],
      },
      services: [{ name: 'web', type: 'custom', url: 'https://example.com' }],
    });
  }
  return common;
}

async function runProvider(provider, env, opts = {}) {
  const command = opts.real ? realDeployCommand(provider, opts.processEnv || process.env) : '';
  const operation = opts.real && command ? 'deploy' : 'plan';
  const dryRun = operation !== 'deploy';
  const result = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation,
    provider,
    project_root: process.cwd(),
    effective_env: env,
    deploy: fixtureDeploy(provider, command),
    run_context: {
      dry_run: dryRun,
      explicit_confirm: !dryRun,
      allow_destructive_deploy: !dryRun,
    },
  }, { dry_run: dryRun });
  assert.strictEqual(result.status, 'completed', `${provider} should complete ${operation}`);
  if (provider !== 'manual' && dryRun) {
    assert(
      ((result.metadata && result.metadata.planned_commands) || []).length > 0,
      `${provider} should produce at least one planned command`,
    );
  } else if (provider !== 'manual') {
    assert(
      Array.isArray(result.command_results) && result.command_results.length > 0,
      `${provider} should produce at least one command result`,
    );
  }
  return {
    provider,
    operation,
    real_deploy: operation === 'deploy',
    status: result.status,
    planned_command_count: ((result.metadata && result.metadata.planned_commands) || []).length,
    command_result_count: Array.isArray(result.command_results) ? result.command_results.length : 0,
  };
}

async function main() {
  const configPath = path.resolve(process.env.PIFLOW_CONFIG_ENV_PATH || DEFAULT_PIFLOW_CONFIG_ENV);
  const env = parseEnvFile(configPath);
  const selected = completeProviders(env);
  const real = realDeployEnabled(process.env);
  const results = [];
  for (const provider of selected) {
    results.push(await runProvider(provider, env, { real, processEnv: process.env }));
  }
  process.stdout.write(JSON.stringify({
    config_env_path: configPath,
    real_deploy_enabled: real,
    selected_providers: selected,
    skipped_providers: [...providers.keys()].filter(provider => !['manual', 'mock'].includes(provider) && !selected.includes(provider)).sort(),
    results,
  }, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = { parseEnvFile, completeProviders, envKeyForProvider, realDeployEnabled, realDeployCommand, fixtureDeploy, runProvider };
