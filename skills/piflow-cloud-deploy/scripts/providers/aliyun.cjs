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
  provider_id: 'aliyun',
  service_types: ['static_site', 'serverless_api', 'container', 'storage', 'cdn', 'oss', 'fc'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'cdn', 'dns', 'secrets'],
  credential_hints: [['ALIBABA_CLOUD_ACCESS_KEY_ID', 'ALIBABA_CLOUD_ACCESS_KEY_SECRET', 'ALIBABA_CLOUD_REGION_ID']],
  required_permissions: ['Alibaba Cloud OSS/FC/SAE deployment permissions', 'CDN refresh permissions when CDN is used', 'DNS permissions when DNS is managed'],
};

async function validate(ctx) {
  const env = Object.assign({}, process.env, ctx.effective_env || {});
  const missing = missingEnv(env, ['ALIBABA_CLOUD_ACCESS_KEY_ID', 'ALIBABA_CLOUD_ACCESS_KEY_SECRET', 'ALIBABA_CLOUD_REGION_ID']);
  if (missing.length > 0) {
    return blocked(ctx, 'aliyun', 'aliyun_credentials_missing', [
      `在系统环境变量或 piflow_runtime/cloud/cloud.env 中配置: ${missing.join(', ')}`,
    ], { missing });
  }
  const result = baseResult(ctx, 'aliyun', 'completed');
  result.services = completedServices(ctx, 'aliyun', 'planned');
  result.actions = planActions(ctx, 'aliyun').map((action) => Object.assign({}, action, { api_family: 'aliyun' }));
  return result;
}

async function plan(ctx) {
  const validation = await validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
  if (validation.status === 'completed') {
    validation.metadata.planned_commands = synthesizeAliyunCommands(ctx).map(item => item.command);
  }
  return validation;
}

function synthesizeAliyunCommands(ctx) {
  return servicesFrom(ctx).flatMap((service) => {
    const type = serviceType(service);
    const cfg = serviceConfig(service, 'aliyun');
    const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
    const artifact = service.artifact_path || service.dist_dir || cfg.artifact_path || cfg.dist_dir || cfg.output_dir || cfg.directory;
    const out = [];
    if ((type === 'static_site' || type === 'oss' || type === 'storage') && artifact && cfg.bucket) {
      out.push({
        command: `ossutil64 sync ${shellQuote(artifact)} oss://${shellQuote(cfg.bucket)}${cfg.prefix ? '/' + shellQuote(cfg.prefix) : ''} --delete`,
        service: serviceName(service),
        cwd,
      });
      if (cfg.cdn_object_path || cfg.cdn_paths) {
        const paths = Array.isArray(cfg.cdn_paths) ? cfg.cdn_paths.join(',') : (cfg.cdn_paths || cfg.cdn_object_path);
        out.push({
          command: `aliyun cdn RefreshObjectCaches --ObjectPath ${shellQuote(paths)} --ObjectType Directory`,
          service: serviceName(service),
          cwd,
        });
      }
      return out;
    }
    if ((type === 'fc' || type === 'serverless_api') && (cfg.service_name || cfg.function_name || cfg.name)) {
      return [{
        command: `s deploy${cfg.service_name ? ' --service-name ' + shellQuote(cfg.service_name) : ''}${cfg.function_name ? ' --function-name ' + shellQuote(cfg.function_name) : ''}`,
        service: serviceName(service),
        cwd,
      }];
    }
    if ((type === 'container' || type === 'sae') && cfg.app_id && cfg.image_url) {
      return [{
        command: `aliyun sae DeployApplication --AppId ${shellQuote(cfg.app_id)} --ImageUrl ${shellQuote(cfg.image_url)}`,
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
    return blocked(ctx, 'aliyun', 'destructive_deploy_not_authorized', ['重新运行 PiFlow deploy 并显式授权 destructive deploy。'], { required_permissions: manifest.required_permissions });
  }
  const commands = [...resolveDeployCommands(ctx, 'aliyun'), ...synthesizeAliyunCommands(ctx)];
  if (commands.length === 0) {
    return blocked(ctx, 'aliyun', 'aliyun_deploy_command_missing', [
      '配置 deploy.aliyun.commands / deploy.services[].deploy_command，或为 OSS/FC/SAE service 填写 bucket/artifact_path、service_name/function_name、app_id/image_url 等可合成阿里云 CLI 命令的字段。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'aliyun', commands);
}

async function finalize(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'aliyun', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) return blocked(ctx, 'aliyun', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 finalize。']);
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'aliyun', commands);
}

async function rollback(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'aliyun', 'rollback');
  if (commands.length === 0) return blocked(ctx, 'aliyun', 'aliyun_rollback_command_missing', ['配置 deploy.aliyun.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  if (!isAuthorized(ctx)) return blocked(ctx, 'aliyun', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 destructive 操作。']);
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'aliyun', commands);
}

module.exports = { manifest, validate, plan, deploy, probe: plan, finalize, rollback, synthesizeAliyunCommands };
