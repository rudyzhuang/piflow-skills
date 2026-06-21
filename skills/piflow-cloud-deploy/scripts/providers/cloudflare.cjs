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
  servicesFrom,
  shellQuote,
  serviceConfig,
  serviceName,
  serviceType,
} = require('./common.cjs');

const manifest = {
  provider_id: 'cloudflare',
  service_types: ['static_site', 'serverless_api', 'worker', 'database', 'storage', 'queue', 'gateway', 'pages', 'workers', 'd1', 'r2', 'kv'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'dns', 'custom_domain', 'secrets', 'migrations', 'cors'],
  credential_hints: [
    ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    ['CF_API_TOKEN', 'CF_ACCOUNT_ID']
  ],
  required_permissions: ['Cloudflare Account read', 'Pages edit', 'Workers edit', 'DNS edit when custom domains are managed'],
};

function cloudflareEnv(ctx) {
  const env = Object.assign({}, process.env, ctx.effective_env || {});
  return {
    token: env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN || '',
    account: env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID || '',
    env,
  };
}

async function validate(ctx) {
  const cf = cloudflareEnv(ctx);
  const missing = [];
  if (!cf.token) missing.push('CLOUDFLARE_API_TOKEN or CF_API_TOKEN');
  if (!cf.account) missing.push('CLOUDFLARE_ACCOUNT_ID or CF_ACCOUNT_ID');
  if (missing.length > 0) {
    return blocked(ctx, 'cloudflare', 'cloudflare_credentials_missing', [
      `在系统环境变量或 piflow_runtime/cloud/cloud.env 中配置: ${missing.join(', ')}`,
    ], { missing });
  }
  const result = baseResult(ctx, 'cloudflare', 'completed');
  result.services = completedServices(ctx, 'cloudflare', 'planned');
  result.actions = planActions(ctx, 'cloudflare');
  result.metadata.capabilities = manifest.capabilities;
  return result;
}

async function plan(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  validation.operation = ctx.operation || 'plan';
  validation.actions = validation.actions.map((action) => Object.assign({}, action, {
    api_family: action.type === 'pages' ? 'cloudflare_pages' : 'cloudflare_workers',
  }));
  validation.metadata.planned_commands = synthesizeCloudflareCommands(ctx).map(item => item.command);
  return validation;
}

function synthesizeCloudflareCommands(ctx) {
  return servicesFrom(ctx).flatMap((service) => {
    const type = serviceType(service);
    const cfg = serviceConfig(service, 'cloudflare');
    const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
    const name = cfg.project_name || cfg.script_name || cfg.name || serviceName(service);
    const artifact = service.artifact_path || service.dist_dir || cfg.artifact_path || cfg.dist_dir || cfg.output_dir || cfg.directory;
    if ((type === 'pages' || type === 'static_site') && artifact) {
      return appendCloudflareServiceCommands(service, [{
        command: `npx wrangler pages deploy ${shellQuote(artifact)} --project-name ${shellQuote(name)}`,
        service: serviceName(service),
        cwd,
      }], ctx);
    }
    if ((type === 'workers' || type === 'worker' || type === 'serverless_api' || type === 'gateway') && (cfg.entry || cfg.script || cfg.config || cfg.wrangler_config)) {
      const parts = ['npx wrangler deploy'];
      if (cfg.entry || cfg.script) parts.push(shellQuote(cfg.entry || cfg.script));
      parts.push('--name', shellQuote(name));
      if (cfg.config || cfg.wrangler_config) parts.push('--config', shellQuote(cfg.config || cfg.wrangler_config));
      return appendCloudflareServiceCommands(service, [{ command: parts.join(' '), service: serviceName(service), cwd }], ctx);
    }
    if (type === 'd1' && (cfg.database || cfg.database_name) && cfg.migrations_dir) {
      return appendCloudflareServiceCommands(service, [{
        command: `npx wrangler d1 migrations apply ${shellQuote(cfg.database || cfg.database_name)} --remote --migrations-dir ${shellQuote(cfg.migrations_dir)}`,
        service: serviceName(service),
        cwd,
      }], ctx);
    }
    return appendCloudflareServiceCommands(service, [], ctx);
  });
}

function appendCloudflareServiceCommands(service, commands, ctx) {
  const cfg = serviceConfig(service, 'cloudflare');
  const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
  const svc = serviceName(service);
  return [
    ...commands,
    ...synthesizeCloudflareResources(service, cfg, cwd, svc),
    ...synthesizeCloudflareSecrets(service, cfg, cwd, svc),
    ...synthesizeCloudflareVars(service, cfg, cwd, svc),
    ...synthesizeCloudflareDnsRecords(service, cfg, cwd, svc),
    ...synthesizeCloudflareRoutes(service, cfg, cwd, svc),
    ...synthesizeCloudflareDomains(service, cfg, cwd, svc),
  ];
}

function synthesizeCloudflareVars(service, cfg, cwd, svc) {
  const scriptName = cfg.script_name || cfg.project_name || cfg.name || serviceName(service);
  const vars = Object.assign({}, cfg.vars || {});
  if (cfg.allowed_origins || cfg.cors_allowed_origins) {
    const value = Array.isArray(cfg.allowed_origins || cfg.cors_allowed_origins)
      ? (cfg.allowed_origins || cfg.cors_allowed_origins).join(',')
      : String(cfg.allowed_origins || cfg.cors_allowed_origins);
    vars.ALLOWED_ORIGINS = value;
  }
  if (cfg.gateway_pages_origins && typeof cfg.gateway_pages_origins === 'object') {
    for (const [key, value] of Object.entries(cfg.gateway_pages_origins)) {
      vars[`${String(key).toUpperCase()}_PAGES_ORIGIN`] = value;
    }
  }
  return Object.entries(vars)
    .filter(([key, value]) => key && value != null && String(value).trim())
    .map(([key, value]) => ({
      command: `printf "%s" ${shellQuote(value)} | npx wrangler secret put ${shellQuote(key)} --name ${shellQuote(scriptName)}`,
      service: svc,
      cwd,
    }));
}

function synthesizeCloudflareResources(service, cfg, cwd, svc) {
  const resources = Array.isArray(cfg.resources) ? cfg.resources : [];
  const out = [];
  for (const resource of resources) {
    const type = String(resource.type || resource.kind || '').toLowerCase();
    const name = resource.name || resource.title || resource.bucket || resource.queue || resource.database;
    if (!name) continue;
    if (type === 'kv') out.push({ command: `npx wrangler kv namespace create ${shellQuote(name)}`, service: svc, cwd });
    if (type === 'r2') out.push({ command: `npx wrangler r2 bucket create ${shellQuote(name)}`, service: svc, cwd });
    if (type === 'queues' || type === 'queue') out.push({ command: `npx wrangler queues create ${shellQuote(name)}`, service: svc, cwd });
    if (type === 'd1') out.push({ command: `npx wrangler d1 create ${shellQuote(name)}`, service: svc, cwd });
  }
  return out;
}

function synthesizeCloudflareSecrets(service, cfg, cwd, svc) {
  const secrets = Array.isArray(cfg.secrets)
    ? cfg.secrets
    : Object.entries(cfg.secrets || {}).map(([name, env]) => ({ name, env }));
  const scriptName = cfg.script_name || cfg.project_name || cfg.name || serviceName(service);
  return secrets
    .filter(secret => secret && secret.name && (secret.env || secret.env_key))
    .map(secret => {
      const envKey = String(secret.env || secret.env_key);
      return {
        command: `printf "%s" "$${envKey}" | npx wrangler secret put ${shellQuote(secret.name)} --name ${shellQuote(scriptName)}`,
        service: svc,
        cwd,
      };
    });
}

function synthesizeCloudflareDnsRecords(service, cfg, cwd, svc) {
  const records = Array.isArray(cfg.dns_records) ? cfg.dns_records : [];
  return records
    .filter(record => record && record.zone_id && record.name && record.type && record.content)
    .map(record => ({
      command: cloudflareApiCommand(
        'POST',
        `/zones/${record.zone_id}/dns_records`,
        {
          type: record.type,
          name: record.name,
          content: record.content,
          proxied: record.proxied !== false,
          ttl: record.ttl || 1,
        },
      ),
      service: svc,
      cwd,
    }));
}

function synthesizeCloudflareRoutes(service, cfg, cwd, svc) {
  const routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  const script = cfg.script_name || cfg.project_name || cfg.name || serviceName(service);
  return routes
    .filter(route => route && route.zone_id && (route.pattern || route.route))
    .map(route => ({
      command: cloudflareApiCommand(
        'POST',
        `/zones/${route.zone_id}/workers/routes`,
        { pattern: route.pattern || route.route, script: route.script || script },
      ),
      service: svc,
      cwd,
    }));
}

function synthesizeCloudflareDomains(service, cfg, cwd, svc) {
  const domains = Array.isArray(cfg.custom_domains) ? cfg.custom_domains : [];
  const pagesDomains = Array.isArray(cfg.pages_domains) ? cfg.pages_domains : [];
  const script = cfg.script_name || cfg.name || serviceName(service);
  const project = cfg.project_name || cfg.name || serviceName(service);
  return [
    ...domains.filter(domain => domain && domain.hostname).map(domain => ({
      command: cloudflareApiCommand(
        'PUT',
        `/accounts/${cfg.account_id || '${CLOUDFLARE_ACCOUNT_ID:-$CF_ACCOUNT_ID}'}/workers/domains`,
        { hostname: domain.hostname, service: domain.script || script, environment: domain.environment || 'production' },
      ),
      service: svc,
      cwd,
    })),
    ...pagesDomains.filter(domain => domain && domain.name).map(domain => ({
      command: cloudflareApiCommand(
        'POST',
        `/accounts/${cfg.account_id || '${CLOUDFLARE_ACCOUNT_ID:-$CF_ACCOUNT_ID}'}/pages/projects/${project}/domains`,
        { name: domain.name },
      ),
      service: svc,
      cwd,
    })),
  ];
}

function cloudflareApiCommand(method, apiPath, body) {
  const url = `https://api.cloudflare.com/client/v4${apiPath}`;
  const quotedUrl = url.includes('${') ? `"${url}"` : shellQuote(url);
  const json = JSON.stringify(body);
  return [
    'curl -fsS',
    '-X', method,
    quotedUrl,
    '-H', '"Authorization: Bearer ${CLOUDFLARE_API_TOKEN:-$CF_API_TOKEN}"',
    '-H', shellQuote('Content-Type: application/json'),
    '--data', shellQuote(json),
  ].join(' ');
}

async function deploy(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  if (isDryRun(ctx)) {
    return plan(Object.assign({}, ctx, { operation: 'deploy' }));
  }
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'cloudflare', 'destructive_deploy_not_authorized', [
      '重新运行 PiFlow deploy 并传入 --explicit-confirm，或开启 pipeline.autorun.allow_destructive_deploy。',
    ], { required_permissions: manifest.required_permissions });
  }
  const commands = [...resolveDeployCommands(ctx, 'cloudflare'), ...synthesizeCloudflareCommands(ctx)];
  if (commands.length === 0) {
    return blocked(ctx, 'cloudflare', 'cloudflare_deploy_command_missing', [
      '配置 deploy.cloudflare.commands / deploy.services[].deploy_command，或为 Pages/Workers/D1 service 填写 artifact_path、entry/config、database/migrations_dir 等可合成 Wrangler 命令的字段。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'cloudflare', commands);
}

async function finalize(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'cloudflare', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'cloudflare', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 finalize。'], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'cloudflare', commands);
}

async function rollback(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'cloudflare', 'rollback');
  if (commands.length === 0) {
    return blocked(ctx, 'cloudflare', 'cloudflare_rollback_command_missing', ['配置 deploy.cloudflare.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  }
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'cloudflare', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 destructive 操作。'], { required_permissions: manifest.required_permissions });
  }
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'cloudflare', commands);
}

module.exports = { manifest, validate, plan, deploy, probe: plan, finalize, rollback, synthesizeCloudflareCommands, cloudflareApiCommand };
