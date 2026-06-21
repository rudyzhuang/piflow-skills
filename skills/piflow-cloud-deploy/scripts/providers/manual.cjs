'use strict';

const { baseResult, blocked, completedServices, isDryRun, planActions, servicesFrom } = require('./common.cjs');

const manifest = {
  provider_id: 'manual',
  service_types: ['static_site', 'serverless_api', 'worker', 'container', 'gateway', 'manual'],
  capabilities: ['validate', 'plan', 'deploy', 'probe', 'finalize'],
  credential_hints: [],
  required_permissions: [],
};

async function validate(ctx) {
  const services = servicesFrom(ctx);
  const missing = services.filter((service) => !service.url && !service.domain);
  if (missing.length > 0) {
    return blocked(ctx, 'manual', 'manual_service_url_missing', [
      `为这些 manual service 配置 url 或 domain: ${missing.map((service) => service.name || service.client_target || 'service').join(', ')}`,
    ], { missing_services: missing.map((service) => service.name || service.client_target || 'service') });
  }
  const result = baseResult(ctx, 'manual', 'completed');
  result.services = completedServices(ctx, 'manual', 'planned');
  result.actions = planActions(ctx, 'manual');
  return result;
}

async function plan(ctx) {
  return validate(Object.assign({}, ctx, { operation: ctx.operation || 'plan' }));
}

async function deploy(ctx) {
  const validation = await validate(ctx);
  if (validation.status !== 'completed') return validation;
  if (isDryRun(ctx)) return plan(Object.assign({}, ctx, { operation: ctx.operation || 'deploy' }));
  validation.operation = ctx.operation || 'deploy';
  validation.services = completedServices(ctx, 'manual', 'deployed');
  validation.actions = validation.services.map((service) => ({
    provider: 'manual',
    action: 'record_service_url',
    service: service.name,
    url: service.url || null,
  }));
  validation.metadata.manual = true;
  return validation;
}

module.exports = { manifest, validate, plan, deploy, probe: deploy, finalize: deploy, rollback: deploy };
