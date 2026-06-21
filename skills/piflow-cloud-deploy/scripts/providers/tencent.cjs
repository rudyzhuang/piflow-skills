'use strict';

const {
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
  servicesFrom,
  shellQuote,
  serviceConfig,
  serviceName,
  serviceType,
} = require('./common.cjs');

const manifest = {
  provider_id: 'tencent',
  service_types: ['static_site', 'serverless_api', 'container', 'storage', 'cdn', 'scf', 'cos', 'tcb'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'cdn', 'dns', 'secrets'],
  credential_hints: [['TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY', 'TENCENTCLOUD_REGION']],
  required_permissions: ['Tencent Cloud COS/SCF/TCB deployment permissions', 'CDN purge permissions when CDN is used', 'DNS permissions when DNS is managed'],
};

async function validate(ctx) {
  const env = Object.assign({}, process.env, ctx.effective_env || {});
  const missing = missingEnv(env, ['TENCENTCLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_KEY', 'TENCENTCLOUD_REGION']);
  if (missing.length > 0) {
    return blocked(ctx, 'tencent', 'tencent_credentials_missing', [
      `在系统环境变量或 piflow_runtime/cloud/cloud.env 中配置: ${missing.join(', ')}`,
    ], { missing });
  }
  const result = baseResult(ctx, 'tencent', 'completed');
  result.services = completedServices(ctx, 'tencent', 'planned');
  result.actions = planActions(ctx, 'tencent').map((action) => Object.assign({}, action, { api_family: 'tencentcloud' }));
  return result;
}

async function plan(ctx) {
  const validation = await validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
  if (validation.status === 'completed') {
    validation.metadata.planned_commands = synthesizeTencentCommands(ctx).map(item => item.command);
  }
  return validation;
}

function synthesizeTencentCommands(ctx) {
  return servicesFrom(ctx).flatMap((service) => {
    const type = serviceType(service);
    const cfg = serviceConfig(service, 'tencent');
    const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
    const artifact = service.artifact_path || service.dist_dir || cfg.artifact_path || cfg.dist_dir || cfg.output_dir || cfg.directory;
    const out = [];
    if ((type === 'static_site' || type === 'cos' || type === 'storage') && artifact && cfg.bucket) {
      out.push({
        command: `coscli sync ${shellQuote(artifact)} cos://${shellQuote(cfg.bucket)}${cfg.prefix ? '/' + shellQuote(cfg.prefix) : ''} --delete`,
        service: serviceName(service),
        cwd,
      });
      if (cfg.cdn_url || cfg.cdn_paths) {
        const paths = Array.isArray(cfg.cdn_paths) ? cfg.cdn_paths.join(',') : (cfg.cdn_paths || `${cfg.cdn_url || ''}/*`);
        out.push({
          command: `tccli cdn PurgePathCache --Paths ${shellQuote(paths)} --FlushType flush`,
          service: serviceName(service),
          cwd,
        });
      }
      return out;
    }
    if ((type === 'scf' || type === 'serverless_api') && (cfg.function_name || cfg.name)) {
      return [{
        command: `scf deploy --name ${shellQuote(cfg.function_name || cfg.name)}${artifact ? ' --src ' + shellQuote(artifact) : ''}`,
        service: serviceName(service),
        cwd,
      }];
    }
    if ((type === 'tcb' || type === 'container') && (cfg.env_id || cfg.environment)) {
      return [{
        command: `tcb framework deploy --envId ${shellQuote(cfg.env_id || cfg.environment)}`,
        service: serviceName(service),
        cwd,
      }];
    }
    return [];
  });
}

async function deploy(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  if (isDryRun(ctx)) return plan(ctx);
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'tencent', 'destructive_deploy_not_authorized', ['重新运行 PiFlow deploy 并显式授权 destructive deploy。'], { required_permissions: manifest.required_permissions });
  }
  const commands = [...resolveDeployCommands(ctx, 'tencent'), ...synthesizeTencentCommands(ctx)];
  if (commands.length === 0) {
    return blocked(ctx, 'tencent', 'tencent_deploy_command_missing', [
      '配置 deploy.tencent.commands / deploy.services[].deploy_command，或为 COS/SCF/TCB service 填写 bucket/artifact_path、function_name、env_id 等可合成腾讯云 CLI 命令的字段。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'tencent', commands);
}

async function finalize(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'tencent', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) return blocked(ctx, 'tencent', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 finalize。']);
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'tencent', commands);
}

async function rollback(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'tencent', 'rollback');
  if (commands.length === 0) return blocked(ctx, 'tencent', 'tencent_rollback_command_missing', ['配置 deploy.tencent.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  if (!isAuthorized(ctx)) return blocked(ctx, 'tencent', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 destructive 操作。']);
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'tencent', commands);
}

module.exports = { manifest, validate, plan, deploy, probe: plan, finalize, rollback, synthesizeTencentCommands };
