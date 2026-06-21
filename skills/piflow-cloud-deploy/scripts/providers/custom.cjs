'use strict';

const {
  baseResult,
  blocked,
  completedServices,
  planActions,
  isAuthorized,
  isDryRun,
  resolveProviderCommands,
  resolveDeployCommands,
  runProviderCommands,
} = require('./common.cjs');

const manifest = {
  provider_id: 'custom',
  service_types: ['static_site', 'serverless_api', 'worker', 'container', 'database', 'storage', 'queue', 'gateway', 'custom'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'custom_command', 'external_adapter'],
  credential_hints: [['PIFLOW_CUSTOM_CLOUD_PROVIDER']],
  required_permissions: ['Project-defined deploy command permissions', 'External adapter permissions when configured'],
};

async function validate(ctx) {
  const result = baseResult(ctx, 'custom', 'completed');
  result.services = completedServices(ctx, 'custom', 'planned');
  result.actions = planActions(ctx, 'custom').map((action) => Object.assign({}, action, { api_family: 'custom' }));
  result.metadata.provider_contract = 'project_defined_commands';
  return result;
}

async function plan(ctx) {
  const validation = await validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
  if (validation.status !== 'completed') return validation;
  const commands = [
    ...resolveDeployCommands(ctx, 'custom'),
    ...resolveProviderCommands(ctx, 'custom', 'probe'),
    ...resolveProviderCommands(ctx, 'custom', 'finalize'),
    ...resolveProviderCommands(ctx, 'custom', 'rollback'),
  ];
  validation.metadata.planned_commands = [...new Set(commands.map(item => item.command))];
  return validation;
}

async function deploy(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  if (isDryRun(ctx)) return plan(ctx);
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'custom', 'destructive_deploy_not_authorized', ['重新运行 PiFlow deploy 并显式授权 custom provider 的 destructive deploy。'], { required_permissions: manifest.required_permissions });
  }
  const commands = resolveDeployCommands(ctx, 'custom');
  if (commands.length === 0) {
    return blocked(ctx, 'custom', 'custom_deploy_command_missing', [
      '配置 deploy.custom.commands / deploy.commands / deploy.services[].deploy_command / deploy.services[].custom.commands，或改用已内建的云平台 provider。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'custom', commands);
}

async function probe(ctx) {
  const commands = resolveProviderCommands(ctx, 'custom', 'probe');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'probe' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'probe' }), 'custom', commands);
}

async function finalize(ctx) {
  const commands = resolveProviderCommands(ctx, 'custom', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'custom', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 custom finalize。'], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'custom', commands);
}

async function rollback(ctx) {
  const commands = resolveProviderCommands(ctx, 'custom', 'rollback');
  if (commands.length === 0) {
    return blocked(ctx, 'custom', 'custom_rollback_command_missing', ['配置 deploy.custom.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  }
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'custom', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 custom rollback。'], { required_permissions: manifest.required_permissions });
  }
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'custom', commands);
}

module.exports = { manifest, validate, plan, deploy, probe, finalize, rollback };
