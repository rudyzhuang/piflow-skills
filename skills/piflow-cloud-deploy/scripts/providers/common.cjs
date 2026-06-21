'use strict';

const { spawnSync } = require('child_process');

const API_VERSION = 'piflow.cloud.deploy/v1';

function servicesFrom(ctx = {}) {
  const deployServices = ctx.deploy && Array.isArray(ctx.deploy.services) ? ctx.deploy.services : [];
  const requestServices = Array.isArray(ctx.services) ? ctx.services : [];
  return requestServices.length > 0 ? requestServices : deployServices;
}

function baseResult(ctx, provider, status = 'completed') {
  return {
    api_version: API_VERSION,
    provider,
    operation: ctx.operation || 'validate',
    status,
    services: [],
    actions: [],
    urls: {},
    probe: {},
    smoke: {},
    failure_context: null,
    user_actions: [],
    metadata: {},
  };
}

function blocked(ctx, provider, reason, userActions = [], extra = {}) {
  const result = baseResult(ctx, provider, 'blocked');
  result.failure_context = {
    recoverable: false,
    failure_class: reason,
    summary: reason,
    provider,
  };
  result.user_actions = userActions;
  result.metadata = Object.assign({}, result.metadata, extra);
  return result;
}

function completedServices(ctx, provider, mode = 'planned') {
  return servicesFrom(ctx).map((service) => ({
    name: service.name || service.service_name || service.client_target || 'service',
    provider,
    status: mode === 'deployed' ? 'completed' : 'planned',
    client_target: service.client_target || null,
    role: service.role || null,
    type: service.type || service.service_type || null,
    url: service.url || service.domain || null,
    metadata: {
      dry_run: mode !== 'deployed',
      resource_config: service.resource_config || {},
    },
  }));
}

function planActions(ctx, provider) {
  return completedServices(ctx, provider, 'planned').map((service) => ({
    provider,
    action: 'plan_service',
    service: service.name,
    type: service.type,
    url: service.url || null,
  }));
}

function missingEnv(env, keys) {
  return keys.filter((key) => !env[key] || !String(env[key]).trim());
}

function isAuthorized(ctx) {
  return !!(ctx.run_context && (ctx.run_context.explicit_confirm === true || ctx.run_context.allow_destructive_deploy === true));
}

function isDryRun(ctx) {
  return ctx.dry_run === true || !!(ctx.run_context && ctx.run_context.dry_run === true);
}

function commandList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function shellQuote(value) {
  const text = String(value == null ? '' : value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

function serviceName(service) {
  return service.name || service.service_name || service.client_target || 'service';
}

function serviceType(service) {
  return String(service.type || service.service_type || service.platform || '').trim().toLowerCase();
}

function serviceConfig(service, provider) {
  return Object.assign(
    {},
    service.resource_config && typeof service.resource_config === 'object' ? service.resource_config : {},
    service[provider] && typeof service[provider] === 'object' ? service[provider] : {},
  );
}

function resolveProviderCommands(ctx, provider, operation = 'deploy') {
  const deploy = ctx.deploy && typeof ctx.deploy === 'object' ? ctx.deploy : {};
  const providerCfg = deploy[provider] && typeof deploy[provider] === 'object' ? deploy[provider] : {};
  const op = String(operation || 'deploy').toLowerCase();
  const opCommandKey = `${op}_command`;
  const opCommandsKey = `${op}_commands`;
  const shared = [
    ...commandList(deploy[opCommandKey]),
    ...commandList(deploy[opCommandsKey]),
    ...commandList(providerCfg[opCommandKey]),
    ...commandList(providerCfg[opCommandsKey]),
    ...(op === 'deploy' ? [
      ...commandList(deploy.command),
      ...commandList(deploy.commands),
      ...commandList(providerCfg.command),
      ...commandList(providerCfg.commands),
    ] : []),
  ];
  const serviceCommands = servicesFrom(ctx).flatMap((service) => {
    const serviceProviderCfg = service && service[provider] && typeof service[provider] === 'object' ? service[provider] : {};
    return [
      ...commandList(service[opCommandKey]),
      ...commandList(service[opCommandsKey]),
      ...commandList(serviceProviderCfg[opCommandKey]),
      ...commandList(serviceProviderCfg[opCommandsKey]),
      ...(op === 'deploy' ? [
        ...commandList(service.deploy_command),
        ...commandList(service.deploy_commands),
        ...commandList(service.command),
        ...commandList(service.commands),
        ...commandList(serviceProviderCfg.command),
        ...commandList(serviceProviderCfg.commands),
      ] : []),
    ].map(command => ({
      command,
      service: service.name || service.client_target || 'service',
      cwd: service.cwd || service.working_directory || deploy.cwd || ctx.project_root || process.cwd(),
    }));
  });
  return [
    ...shared.map(command => ({
      command,
      service: null,
      cwd: deploy.cwd || ctx.project_root || process.cwd(),
    })),
    ...serviceCommands,
  ];
}

function resolveDeployCommands(ctx, provider) {
  return resolveProviderCommands(ctx, provider, 'deploy');
}

function runProviderCommands(ctx, provider, commands, opts = {}) {
  const commandEnv = Object.assign({}, process.env, ctx.effective_env || {});
  const result = baseResult(ctx, provider, 'completed');
  result.services = completedServices(ctx, provider, 'deployed');
  result.actions = commands.map((item) => ({
    provider,
    action: 'run_command',
    service: item.service,
    command: item.command,
    cwd: item.cwd,
  }));
  result.metadata.command_runner = {
    provider,
    command_count: commands.length,
  };
  result.command_results = [];

  for (const item of commands) {
    const child = spawnSync(item.command, {
      cwd: item.cwd || ctx.project_root || process.cwd(),
      env: commandEnv,
      encoding: 'utf8',
      shell: true,
      timeout: opts.timeoutMs || 900000,
      maxBuffer: 1024 * 1024,
    });
    const commandResult = {
      service: item.service,
      command: item.command,
      cwd: item.cwd,
      exit_code: child.status == null ? 1 : child.status,
      stdout_tail: redactTextWithEnv(tail(child.stdout || ''), commandEnv),
      stderr_tail: redactTextWithEnv(tail(child.stderr || ''), commandEnv),
    };
    result.command_results.push(commandResult);
    if (commandResult.exit_code !== 0) {
      result.status = 'failed';
      result.failure_context = {
        recoverable: true,
        failure_class: `${provider}_deploy_command_failed`,
        summary: `${provider} deploy command failed: ${item.command}`,
        provider,
        service: item.service,
      };
      result.user_actions = [`检查部署命令、云 CLI 登录状态和权限：${item.command}`];
      break;
    }
  }
  return result;
}

function tail(text, limit = 4000) {
  const value = String(text || '');
  return value.length <= limit ? value : value.slice(value.length - limit);
}

function redactTextWithEnv(text, env) {
  let out = String(text || '');
  for (const [key, value] of Object.entries(env || {})) {
    if (!/(TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|SERVICE[_-]?ACCOUNT|ACCESS[_-]?KEY|SESSION|COOKIE)/i.test(key)) continue;
    const secret = String(value || '');
    if (secret.length < 4) continue;
    out = out.split(secret).join('***');
  }
  return out;
}

module.exports = {
  API_VERSION,
  servicesFrom,
  baseResult,
  blocked,
  completedServices,
  planActions,
  missingEnv,
  isAuthorized,
  isDryRun,
  resolveProviderCommands,
  resolveDeployCommands,
  runProviderCommands,
  redactTextWithEnv,
  shellQuote,
  serviceName,
  serviceType,
  serviceConfig,
};
