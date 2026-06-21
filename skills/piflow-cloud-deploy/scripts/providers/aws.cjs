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
  provider_id: 'aws',
  service_types: ['static_site', 'serverless_api', 'container', 'database', 'storage', 'queue', 'gateway'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'dns', 'custom_domain', 'secrets'],
  credential_hints: [['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']],
  required_permissions: ['S3/CloudFront or Amplify deploy permissions', 'Lambda/API Gateway or App Runner permissions', 'Route53/ACM when custom domains are managed', 'Secrets Manager when secrets are used'],
};

async function validate(ctx) {
  const env = Object.assign({}, process.env, ctx.effective_env || {});
  const missing = missingEnv(env, ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']);
  if (missing.length > 0) {
    return blocked(ctx, 'aws', 'aws_credentials_missing', [
      `在系统环境变量或 piflow_runtime/cloud/cloud.env 中配置: ${missing.join(', ')}`,
    ], { missing });
  }
  const result = baseResult(ctx, 'aws', 'completed');
  result.services = completedServices(ctx, 'aws', 'planned');
  result.actions = planActions(ctx, 'aws').map((action) => Object.assign({}, action, { api_family: 'aws' }));
  return result;
}

async function plan(ctx) {
  const validation = await validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
  if (validation.status === 'completed') {
    validation.metadata.planned_commands = synthesizeAwsCommands(ctx).map(item => item.command);
  }
  return validation;
}

function synthesizeAwsCommands(ctx) {
  return servicesFrom(ctx).flatMap((service) => {
    const type = serviceType(service);
    const cfg = serviceConfig(service, 'aws');
    const cwd = service.cwd || service.working_directory || cfg.cwd || (ctx.deploy && ctx.deploy.cwd) || ctx.project_root || process.cwd();
    const artifact = service.artifact_path || service.dist_dir || cfg.artifact_path || cfg.dist_dir || cfg.output_dir || cfg.directory;
    const commands = [];
    if ((type === 'static_site' || type === 's3' || type === 'cloudfront') && artifact && cfg.bucket) {
      commands.push({
        command: `aws s3 sync ${shellQuote(artifact)} s3://${shellQuote(cfg.bucket)} --delete`,
        service: serviceName(service),
        cwd,
      });
      if (cfg.distribution_id) {
        commands.push({
          command: `aws cloudfront create-invalidation --distribution-id ${shellQuote(cfg.distribution_id)} --paths '/*'`,
          service: serviceName(service),
          cwd,
        });
      }
      return commands;
    }
    if ((type === 'lambda' || type === 'serverless_api') && cfg.function_name && (cfg.zip_file || artifact)) {
      return [{
        command: `aws lambda update-function-code --function-name ${shellQuote(cfg.function_name)} --zip-file fileb://${shellQuote(cfg.zip_file || artifact)}`,
        service: serviceName(service),
        cwd,
      }];
    }
    if ((type === 'container' || type === 'apprunner') && cfg.service_arn && cfg.image_identifier) {
      return [{
        command: `aws apprunner update-service --service-arn ${shellQuote(cfg.service_arn)} --source-configuration ImageRepository={ImageIdentifier=${shellQuote(cfg.image_identifier)},ImageRepositoryType=ECR}`,
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
    return blocked(ctx, 'aws', 'destructive_deploy_not_authorized', ['重新运行 PiFlow deploy 并显式授权 destructive deploy。'], { required_permissions: manifest.required_permissions });
  }
  const commands = [...resolveDeployCommands(ctx, 'aws'), ...synthesizeAwsCommands(ctx)];
  if (commands.length === 0) {
    return blocked(ctx, 'aws', 'aws_deploy_command_missing', [
      '配置 deploy.aws.commands / deploy.services[].deploy_command，或为 static_site/lambda/apprunner service 填写 bucket/artifact_path、function_name/zip_file、service_arn/image_identifier 等可合成 AWS CLI 命令的字段。',
    ], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(ctx, 'aws', commands);
}

async function finalize(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'aws', 'finalize');
  if (commands.length === 0 || isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'finalize' }));
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'aws', 'finalize_not_authorized', ['重新运行 PiFlow deploy 并显式授权 finalize。'], { required_permissions: manifest.required_permissions });
  }
  return runProviderCommands(Object.assign({}, ctx, { operation: 'finalize' }), 'aws', commands);
}

async function rollback(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  const commands = resolveProviderCommands(ctx, 'aws', 'rollback');
  if (commands.length === 0) {
    return blocked(ctx, 'aws', 'aws_rollback_command_missing', ['配置 deploy.aws.rollback_commands 或 deploy.services[].rollback_command 后再执行 rollback。']);
  }
  if (!isAuthorized(ctx)) {
    return blocked(ctx, 'aws', 'rollback_not_authorized', ['重新运行 PiFlow rollback 并显式授权 destructive 操作。'], { required_permissions: manifest.required_permissions });
  }
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: 'rollback' }));
  return runProviderCommands(Object.assign({}, ctx, { operation: 'rollback' }), 'aws', commands);
}

module.exports = { manifest, validate, plan, deploy, probe: plan, finalize, rollback, synthesizeAwsCommands };
