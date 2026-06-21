#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { resolveProvider } = require('./providers/registry.cjs');
const { redact } = require('./redact.cjs');
const { API_VERSION, blocked } = require('./providers/common.cjs');

const VALID_OPERATIONS = new Set(['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'doctor']);

function parseArgs(argv) {
  const args = { dry_run: false, json: false, input: '', project: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === '--dry-run') args.dry_run = true;
    else if (raw === '--json') args.json = true;
    else if (raw.startsWith('--input=')) args.input = raw.slice('--input='.length);
    else if (raw === '--input' && argv[i + 1]) {
      args.input = argv[i + 1];
      i += 1;
    }
    else if (raw.startsWith('--project=')) args.project = raw.slice('--project='.length);
    else if (raw === '--project' && argv[i + 1]) {
      args.project = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readStdin() {
  try {
    const chunks = fs.readFileSync(0, 'utf8');
    return chunks && chunks.trim() ? chunks : '';
  } catch (_) {
    return '';
  }
}

function readRequest(args) {
  const text = args.input
    ? fs.readFileSync(path.resolve(args.input), 'utf8')
    : readStdin();
  if (!text.trim()) {
    return { api_version: API_VERSION, operation: 'doctor', project_root: args.project || process.cwd() };
  }
  const req = JSON.parse(text);
  if (args.project && !req.project_root) req.project_root = args.project;
  return req;
}

function validateRequest(req) {
  if (!req || typeof req !== 'object') return 'request must be a JSON object';
  if (req.api_version !== API_VERSION) return `unsupported api_version: ${req.api_version || '(missing)'}`;
  if (!req.operation) return 'operation is required';
  const op = String(req.operation || '').trim().toLowerCase();
  if (!VALID_OPERATIONS.has(op)) return `unsupported operation: ${req.operation}`;
  return null;
}

async function dispatch(request, cliArgs) {
  const req = Object.assign({}, request);
  if (cliArgs.dry_run) {
    req.dry_run = true;
    req.run_context = Object.assign({}, req.run_context || {}, { dry_run: true });
  }

  const invalid = validateRequest(req);
  if (invalid) return blocked(req, 'unknown', 'invalid_request', [invalid]);

  const resolution = resolveProvider(req);
  if (!resolution.ok) {
    const result = blocked(req, resolution.provider_id || 'unknown', resolution.reason || 'provider_resolution_failed', [
      resolution.reason === 'ambiguous_provider'
        ? '显式设置 deploy.provider 或 CLOUD_PROVIDER，避免多个云平台凭证冲突。'
        : `安装或配置受支持 provider: ${(resolution.candidates || []).join(', ')}`,
    ], { provider_resolution: resolution });
    result.metadata.provider_resolution = resolution;
    return result;
  }

  const provider = resolution.provider;
  const op = String(req.operation || 'validate').toLowerCase();
  const handler = provider[op] || provider.validate;
  const result = await handler(Object.assign({}, req, {
    provider: resolution.provider_id,
    provider_resolution: Object.assign({}, req.provider_resolution || {}, {
      provider: resolution.provider_id,
      source: resolution.source,
      candidates: resolution.candidates,
    }),
  }));
  result.metadata = Object.assign({}, result.metadata || {}, {
    provider_resolution: {
      provider: resolution.provider_id,
      source: resolution.source,
      candidates: resolution.candidates || [],
    },
    dry_run: !!req.dry_run,
  });
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const request = readRequest(args);
    const result = await dispatch(request, args);
    process.stdout.write(JSON.stringify(redact(result), null, 2) + '\n');
    process.exit(result.status === 'failed' ? 4 : result.status === 'blocked' ? 9 : 0);
  } catch (error) {
    const result = blocked({ operation: 'unknown' }, 'unknown', 'runner_error', [error.message]);
    process.stdout.write(JSON.stringify(redact(result), null, 2) + '\n');
    process.exit(4);
  }
}

if (require.main === module) {
  main();
}

module.exports = { VALID_OPERATIONS, parseArgs, readRequest, validateRequest, dispatch };
