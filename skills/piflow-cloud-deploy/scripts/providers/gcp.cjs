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
  provider_id: 'gcp',
  service_types: ['static_site', 'serverless_api', 'container', 'database', 'storage', 'queue', 'gateway'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'dns', 'custom_domain', 'secrets'],
  credential_hints: [['GCP_PROJECT_ID', 'GCP_SERVICE_ACCOUNT_KEY_JSON']],
  required_permissions: ['Cloud Run or Firebase/Cloud Storage deployment permissions', 'Cloud DNS when custom domains are managed', 'Secret Manager when secrets are used'],
};

async function validate(ctx) {
  const env = Object.assign({}, process.env, ctx.effective_env || {});
  const missing = missingEnv(env, ['GCP_PROJECT_ID', 'GCP_SERVICE_ACCOUNT_KEY_JSON']);
  if (missing.length > 0) {
    return blocked(ctx, 'gcp', 'gcp_credentials_missing', [
      `在系统环境变量或 piflow_runtime/cloud/cloud.env 中配置: ${missing.join(', ')}`,
    ], { missing });
  }
  const result = baseResult(ctx, 'gcp', 'completed');
  result.services = completedServices(ctx, 'gcp', 'planned');
  result.actions = planActions(ctx, 'gcp').map((action) => Object.assign({}, action, { api_family: 'gcp' }));
  return result;
}

async function plan(ctx) {
  const validation = await validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
  if (validation.status === 'completed') {
    validation.metadata.planned_commands = synthesizeGcpCommands(ctx).map(item => item.command);
  }
  return validation;
}

function synthesizeGcpCommands(ctx) {
  return servicesFrom(ctx).flatMap((service) => {
    const type = serviceType(service);
    const cfg = serviceConfig(service, 'gcp');
    const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
    const artifact = service.artifact_path || service.dist_dir || cfg.artifact_path || cfg.dist_dir || cfg.output_dir || cfg.directory;
    if ((type === 'cloud_run' || type === 'cloudrun' || type === 'serverless_api' || type === 'container') && (cfg.service || cfg.service_name) && cfg.image) {
      const region = cfg.region ? ` --region ${shellQuote(cfg.region)}` : '';
      return [{
        command: `gcloud run deploy ${shellQuote(cfg.service || cfg.service_name)} --image ${shellQuote(cfg.image)}${region} --quiet`,
        service: serviceName(service),
        cwd,
      }];
    }
    if ((type === 'firebase' || type === 'static_site') && (cfg.firebase_project || cfg.project_id) && artifact) {
      return [{
        command: `npx firebase deploy --project ${shellQuote(cfg.firebase_project || cfg.project_id)} --only hosting`,
        service: serviceName(service),
        cwd,
      }];
    }
    if ((type === 'storage' || type === 'gcs') && artifact && cfg.bucket) {
      return [{
        command: `gcloud storage rsync ${shellQuote(artifact)} gs://${shellQuote(cfg.bucket)} --recursive --delete-unmatched-destination-objects`,
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
    return blocked(ctx, 'gcp', 'destructive_deploy_not_authorized', ['重新运行 PiFlow deploy 并显式授权 destructive deploy。'], { required_permissions: manifest.required_permissions });
  }
  const commands = [...resolveDeployCommands(ctx, 'gcp'), ...synthesizeGcpCommands(ctx)];
  if (commands.length === 0) {
    return blocked(ctx, 'gcp', 'gcp_deploy_command_missing', [
      '配置 deploy.gcp.commands / deploy.services[].deploy_command，或为 Cloud Run/Firebase/GCS service 填写 service/image、project_id/artifact_path、bucket 等可合成 GCP CLI 命令的字段。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'gcp', commands);
}

async function finalize(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'gcp', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'gcp', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 finalize。'], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'gcp', commands);
}

async function rollback(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'gcp', 'rollback');
  if (commands.length === 0) {
    return blocked(ctx, 'gcp', 'gcp_rollback_command_missing', ['配置 deploy.gcp.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  }
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'gcp', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 destructive 操作。'], { required_permissions: manifest.required_permissions });
  }
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'gcp', commands);
}

module.exports = { manifest, validate, plan, deploy, probe: plan, finalize, rollback, synthesizeGcpCommands };
