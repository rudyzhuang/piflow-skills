'use strict';

const { baseResult, completedServices, planActions } = require('./common.cjs');

const manifest = {
  provider_id: 'mock',
  service_types: ['static_site', 'serverless_api', 'worker', 'container', 'database', 'storage', 'queue', 'gateway'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'dns', 'custom_domain', 'secrets', 'migrations', 'cors'],
  credential_hints: [],
  required_permissions: [],
};

async function run(ctx) {
  const result = baseResult(ctx, 'mock', 'completed');
  result.services = completedServices(ctx, 'mock', ctx.operation === 'deploy' ? 'deployed' : 'planned');
  result.actions = planActions(ctx, 'mock');
  result.metadata.mock = true;
  return result;
}

module.exports = { manifest, validate: run, plan: run, deploy: run, probe: run, finalize: run, rollback: run };
