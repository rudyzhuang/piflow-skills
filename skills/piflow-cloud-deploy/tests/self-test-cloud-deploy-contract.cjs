#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { VALID_OPERATIONS, dispatch, parseArgs: parseCloudDeployArgs, validateRequest } = require('../scripts/cloud_deploy.cjs');
const { parseArgs: parseDoctorArgs } = require('../scripts/doctor.cjs');
const { redact } = require('../scripts/redact.cjs');
const { providers, resolveProvider } = require('../scripts/providers/registry.cjs');
const { synthesizeCloudflareCommands, cloudflareApiCommand } = require('../scripts/providers/cloudflare.cjs');
const { synthesizeAwsCommands } = require('../scripts/providers/aws.cjs');
const { synthesizeGcpCommands } = require('../scripts/providers/gcp.cjs');
const { synthesizeTencentCommands } = require('../scripts/providers/tencent.cjs');
const { synthesizeAliyunCommands } = require('../scripts/providers/aliyun.cjs');

async function main() {
  const expectedProviders = ['manual', 'mock', 'cloudflare', 'aws', 'gcp', 'tencent', 'aliyun', 'custom'];
  assert.deepStrictEqual([...providers.keys()].sort(), expectedProviders.sort());
  for (const [providerId, provider] of providers.entries()) {
    assert.strictEqual(provider.manifest.provider_id, providerId);
    assert(Array.isArray(provider.manifest.service_types), `${providerId} service_types must be an array`);
    assert(provider.manifest.service_types.length > 0, `${providerId} service_types must not be empty`);
    assert(Array.isArray(provider.manifest.capabilities), `${providerId} capabilities must be an array`);
    assert(provider.manifest.capabilities.includes('validate'), `${providerId} must support validate`);
    assert(provider.manifest.capabilities.includes('plan'), `${providerId} must support plan`);
    assert(Array.isArray(provider.manifest.credential_hints), `${providerId} credential_hints must be an array`);
    assert(Array.isArray(provider.manifest.required_permissions), `${providerId} required_permissions must be an array`);
    assert.strictEqual(typeof provider.validate, 'function', `${providerId} validate handler missing`);
    assert.strictEqual(typeof provider.plan, 'function', `${providerId} plan handler missing`);
  }

  const manualReq = require('./fixtures/manual-request.json');
  ['validate', 'plan', 'deploy', 'probe', 'finalize', 'rollback', 'doctor'].forEach((operation) => {
    assert(VALID_OPERATIONS.has(operation), `VALID_OPERATIONS should include ${operation}`);
  });
  assert.strictEqual(validateRequest({ api_version: 'piflow.cloud.deploy/v1', operation: 'explode' }), 'unsupported operation: explode');

  assert.strictEqual(parseCloudDeployArgs(['--input', 'request.json', '--dry-run']).input, 'request.json');
  assert.strictEqual(parseCloudDeployArgs(['--input=request2.json']).input, 'request2.json');
  assert.strictEqual(parseCloudDeployArgs(['--project', '/tmp/demo']).project, '/tmp/demo');
  assert.strictEqual(parseCloudDeployArgs(['--project=/tmp/demo2']).project, '/tmp/demo2');
  assert.strictEqual(parseDoctorArgs(['--project', '/tmp/demo', '--json']).project, '/tmp/demo');
  assert.strictEqual(parseDoctorArgs(['--project=/tmp/demo2', '--json']).project, '/tmp/demo2');

  const manual = await dispatch(manualReq, { dry_run: true });
  assert.strictEqual(manual.status, 'completed');
  assert.strictEqual(manual.provider, 'manual');
  assert.strictEqual(manual.services[0].status, 'planned');
  assert.strictEqual(manual.services[0].metadata.dry_run, true);

  const mock = await dispatch(Object.assign({}, manualReq, {
    provider: 'mock',
    deploy: Object.assign({}, manualReq.deploy, { provider: 'mock' }),
  }), { dry_run: true });
  assert.strictEqual(mock.status, 'completed');
  assert.strictEqual(mock.provider, 'mock');

  const blocked = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'validate',
    provider: 'cloudflare',
    effective_env: {},
    deploy: { provider: 'cloudflare', services: [] },
  }, { dry_run: true });
  assert.strictEqual(blocked.status, 'blocked');
  assert.strictEqual(blocked.failure_context.failure_class, 'cloudflare_credentials_missing');

  const commandDeploy = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'deploy',
    provider: 'aws',
    effective_env: {
      AWS_ACCESS_KEY_ID: 'access',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_REGION: 'us-east-1',
    },
    deploy: {
      provider: 'aws',
      commands: [`${process.execPath} -e "process.stdout.write(process.env.AWS_SECRET_ACCESS_KEY)" `],
      services: [{ name: 'web', type: 'static_site', url: 'https://example.com' }],
    },
    run_context: {
      explicit_confirm: true,
    },
  }, { dry_run: false });
  assert.strictEqual(commandDeploy.status, 'completed');
  assert.strictEqual(commandDeploy.command_results[0].exit_code, 0);
  assert(!JSON.stringify(commandDeploy).includes('secret'), 'command output must redact secret values from env');
  assert.strictEqual(commandDeploy.command_results[0].stdout_tail, '***');

  const rollback = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'rollback',
    provider: 'aws',
    effective_env: {
      AWS_ACCESS_KEY_ID: 'access',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_REGION: 'us-east-1',
    },
    deploy: {
      provider: 'aws',
      commands: [`${process.execPath} -e "process.exit(7)"`],
      aws: {
        rollback_commands: [`${process.execPath} -e "process.stdout.write('rollback ok')"`],
      },
      services: [{ name: 'web', type: 'static_site', url: 'https://example.com' }],
    },
    run_context: {
      explicit_confirm: true,
    },
  }, { dry_run: false });
  assert.strictEqual(rollback.status, 'completed');
  assert.strictEqual(rollback.command_results[0].stdout_tail, 'rollback ok');

  const customPlan = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'plan',
    provider: 'custom',
    deploy: {
      provider: 'custom',
      custom: {
        commands: [`${process.execPath} -e "process.stdout.write('custom deploy')"`],
      },
      services: [{ name: 'web', type: 'custom', url: 'https://example.com' }],
    },
  }, { dry_run: true });
  assert.strictEqual(customPlan.status, 'completed');
  assert.deepStrictEqual(customPlan.metadata.planned_commands, [`${process.execPath} -e "process.stdout.write('custom deploy')"`]);

  const customDeploy = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'deploy',
    provider: 'project-script',
    deploy: {
      provider: 'project-script',
      custom: {
        commands: [`${process.execPath} -e "process.stdout.write('custom ok')"`],
      },
      services: [{ name: 'web', type: 'custom', url: 'https://example.com' }],
    },
    run_context: {
      explicit_confirm: true,
    },
  }, { dry_run: false });
  assert.strictEqual(customDeploy.provider, 'custom');
  assert.strictEqual(customDeploy.status, 'completed');
  assert.strictEqual(customDeploy.command_results[0].stdout_tail, 'custom ok');

  const cfCommands = synthesizeCloudflareCommands({
    project_root: '/tmp/project',
    deploy: {
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        cloudflare: {
          project_name: 'demo-web',
          resources: [
            { type: 'kv', name: 'DEMO_KV' },
            { type: 'r2', name: 'demo-r2' },
            { type: 'queue', name: 'demo-queue' },
          ],
          secrets: [{ name: 'API_TOKEN', env: 'API_TOKEN' }],
          dns_records: [{ zone_id: 'zone1', type: 'CNAME', name: 'www.example.com', content: 'demo.pages.dev' }],
          routes: [{ zone_id: 'zone1', pattern: 'api.example.com/*', script: 'demo-api' }],
          custom_domains: [{ hostname: 'api.example.com' }],
          pages_domains: [{ name: 'www.example.com' }],
          allowed_origins: ['https://web.example.com', 'https://admin.example.com'],
          gateway_pages_origins: {
            website: 'https://demo-web.pages.dev',
            admin: 'https://demo-admin.pages.dev',
          },
        },
      }],
    },
  });
  const cfCommandText = cfCommands.map(item => item.command).join('\n');
  assert(cfCommandText.includes('npx wrangler pages deploy dist/web --project-name demo-web'));
  assert(cfCommandText.includes('npx wrangler kv namespace create DEMO_KV'));
  assert(cfCommandText.includes('npx wrangler r2 bucket create demo-r2'));
  assert(cfCommandText.includes('npx wrangler queues create demo-queue'));
  assert(cfCommandText.includes('printf "%s" "$API_TOKEN" | npx wrangler secret put API_TOKEN --name demo-web'));
  assert(cfCommandText.includes('https://web.example.com,https://admin.example.com'));
  assert(cfCommandText.includes('npx wrangler secret put ALLOWED_ORIGINS --name demo-web'));
  assert(cfCommandText.includes('npx wrangler secret put WEBSITE_PAGES_ORIGIN --name demo-web'));
  assert(cfCommandText.includes('npx wrangler secret put ADMIN_PAGES_ORIGIN --name demo-web'));
  assert(cfCommandText.includes('/zones/zone1/dns_records'));
  assert(cfCommandText.includes('/zones/zone1/workers/routes'));
  assert(cfCommandText.includes('/workers/domains'));
  assert(cfCommandText.includes('/pages/projects/demo-web/domains'));
  assert(cfCommandText.includes('${CLOUDFLARE_API_TOKEN:-$CF_API_TOKEN}'));

  const apiCommand = cloudflareApiCommand('POST', '/zones/z/dns_records', { type: 'A', name: 'x', content: '192.0.2.1' });
  assert(apiCommand.includes('"Authorization: Bearer ${CLOUDFLARE_API_TOKEN:-$CF_API_TOKEN}"'));

  const awsCommands = synthesizeAwsCommands({
    project_root: '/tmp/project',
    deploy: {
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        aws: { bucket: 'demo-bucket', distribution_id: 'D123' },
      }],
    },
  });
  assert.deepStrictEqual(awsCommands.map(item => item.command), [
    'aws s3 sync dist/web s3://demo-bucket --delete',
    "aws cloudfront create-invalidation --distribution-id D123 --paths '/*'",
  ]);

  const gcpCommands = synthesizeGcpCommands({
    project_root: '/tmp/project',
    deploy: {
      services: [{
        name: 'api',
        type: 'cloud_run',
        gcp: { service: 'demo-api', image: 'us-docker.pkg.dev/demo/api:latest', region: 'asia-east1' },
      }],
    },
  });
  assert.strictEqual(gcpCommands[0].command, 'gcloud run deploy demo-api --image us-docker.pkg.dev/demo/api:latest --region asia-east1 --quiet');

  const awsPlan = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'plan',
    provider: 'aws',
    effective_env: {
      AWS_ACCESS_KEY_ID: 'access',
      AWS_SECRET_ACCESS_KEY: 'secret',
      AWS_REGION: 'us-east-1',
    },
    deploy: {
      provider: 'aws',
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        aws: { bucket: 'demo-bucket' },
      }],
    },
  }, { dry_run: true });
  assert.strictEqual(awsPlan.status, 'completed');
  assert.deepStrictEqual(awsPlan.metadata.planned_commands, ['aws s3 sync dist/web s3://demo-bucket --delete']);

  const tencentCommands = synthesizeTencentCommands({
    project_root: '/tmp/project',
    deploy: {
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        tencent: { bucket: 'demo-cos', cdn_url: 'https://cdn.example.com' },
      }],
    },
  });
  assert.deepStrictEqual(tencentCommands.map(item => item.command), [
    'coscli sync dist/web cos://demo-cos --delete',
    "tccli cdn PurgePathCache --Paths 'https://cdn.example.com/*' --FlushType flush",
  ]);

  const aliyunCommands = synthesizeAliyunCommands({
    project_root: '/tmp/project',
    deploy: {
      services: [{
        name: 'web',
        type: 'static_site',
        artifact_path: 'dist/web',
        aliyun: { bucket: 'demo-oss', cdn_object_path: 'https://cdn.example.com/' },
      }],
    },
  });
  assert.deepStrictEqual(aliyunCommands.map(item => item.command), [
    'ossutil64 sync dist/web oss://demo-oss --delete',
    'aliyun cdn RefreshObjectCaches --ObjectPath https://cdn.example.com/ --ObjectType Directory',
  ]);

  const tencentPlan = await dispatch({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'plan',
    provider: 'tencent',
    effective_env: {
      TENCENTCLOUD_SECRET_ID: 'id',
      TENCENTCLOUD_SECRET_KEY: 'key',
      TENCENTCLOUD_REGION: 'ap-guangzhou',
    },
    deploy: {
      provider: 'tencent',
      services: [{ name: 'web', type: 'static_site', artifact_path: 'dist/web', tencent: { bucket: 'demo-cos' } }],
    },
  }, { dry_run: true });
  assert.strictEqual(tencentPlan.status, 'completed');
  assert.deepStrictEqual(tencentPlan.metadata.planned_commands, ['coscli sync dist/web cos://demo-cos --delete']);

  const ambiguous = resolveProvider({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'validate',
    effective_env: {
      CLOUDFLARE_API_TOKEN: 'cf-token',
      CLOUDFLARE_ACCOUNT_ID: 'cf-account',
      GCP_PROJECT_ID: 'gcp-project',
      GCP_SERVICE_ACCOUNT_KEY_JSON: '{}'
    },
    deploy: { provider: 'auto' },
  });
  assert.strictEqual(ambiguous.ok, false);
  assert.strictEqual(ambiguous.reason, 'ambiguous_provider');

  const partialTencentCustom = resolveProvider({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'validate',
    effective_env: {
      TENCENTCLOUD_SECRET_ID: 'id',
      PIFLOW_CUSTOM_CLOUD_PROVIDER: 'project-script',
    },
    deploy: { provider: 'auto' },
  });
  assert.strictEqual(partialTencentCustom.ok, true);
  assert.strictEqual(partialTencentCustom.provider_id, 'custom');

  const customResolved = resolveProvider({
    api_version: 'piflow.cloud.deploy/v1',
    operation: 'validate',
    effective_env: {
      PIFLOW_CUSTOM_CLOUD_PROVIDER: 'project-script',
    },
    deploy: { provider: 'auto' },
  });
  assert.strictEqual(customResolved.ok, true);
  assert.strictEqual(customResolved.provider_id, 'custom');

  const redacted = redact({ CLOUDFLARE_API_TOKEN: '1234567890abcdef', nested: { PASSWORD: 'secret' } });
  assert.notStrictEqual(redacted.CLOUDFLARE_API_TOKEN, '1234567890abcdef');
  assert.strictEqual(redacted.nested.PASSWORD, '***');

  process.stdout.write('self-test-cloud-deploy-contract: ok\n');
}

main().catch((error) => {
  process.stderr.write(error.stack + '\n');
  process.exit(1);
});
