'use strict';

const manual = require('./manual.cjs');
const mock = require('./mock.cjs');
const cloudflare = require('./cloudflare.cjs');
const aws = require('./aws.cjs');
const gcp = require('./gcp.cjs');
const tencent = require('./tencent.cjs');
const aliyun = require('./aliyun.cjs');
const custom = require('./custom.cjs');

const providers = new Map([
  [manual.manifest.provider_id, manual],
  [mock.manifest.provider_id, mock],
  [cloudflare.manifest.provider_id, cloudflare],
  [aws.manifest.provider_id, aws],
  [gcp.manifest.provider_id, gcp],
  [tencent.manifest.provider_id, tencent],
  [aliyun.manifest.provider_id, aliyun],
  [custom.manifest.provider_id, custom],
]);

function normalizeProvider(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'tencentcloud' || raw === 'tencent-cloud' || raw === 'qcloud') return 'tencent';
  if (raw === 'alibaba' || raw === 'alibaba-cloud' || raw === 'aliyun-cloud' || raw === 'ali') return 'aliyun';
  if (raw === 'external' || raw === 'external-provider' || raw === 'project-script') return 'custom';
  return raw;
}

function providerScore(provider, env = {}) {
  const hints = provider.manifest.credential_hints || [];
  let score = 0;
  const matched = [];
  const missing = [];
  for (const group of hints) {
    const ok = group.every((key) => env[key] && String(env[key]).trim());
    if (ok) {
      score += group.length;
      matched.push(group);
    } else {
      missing.push(group.filter((key) => !env[key] || !String(env[key]).trim()));
    }
  }
  return { score, matched, missing };
}

function resolveProvider(request = {}) {
  const env = Object.assign({}, process.env, request.effective_env || {});
  const fromRequest = normalizeProvider(request.provider);
  const fromDeploy = normalizeProvider(request.deploy && request.deploy.provider);
  const fromResolution = normalizeProvider(request.provider_resolution && request.provider_resolution.provider);
  const fromEnv = normalizeProvider(env.PIFLOW_CLOUD_PROVIDER || env.CLOUD_PROVIDER);
  const explicit = [fromRequest, fromDeploy, fromResolution, fromEnv].find((value) => value && value !== 'auto');

  if (explicit) {
    if (!providers.has(explicit)) {
      return {
        ok: false,
        provider_id: explicit,
        reason: 'unknown_provider',
        candidates: [...providers.keys()],
      };
    }
    return {
      ok: true,
      provider_id: explicit,
      provider: providers.get(explicit),
      source: fromRequest ? 'request.provider' : fromDeploy ? 'deploy.provider' : fromResolution ? 'provider_resolution.provider' : 'env',
      candidates: [],
    };
  }

  const scored = [...providers.values()]
    .filter((provider) => provider.manifest.provider_id !== 'manual' && provider.manifest.provider_id !== 'mock')
    .map((provider) => ({
      provider_id: provider.manifest.provider_id,
      score: providerScore(provider, env).score,
      provider,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.provider_id.localeCompare(b.provider_id));

  if (scored.length === 0) {
    return { ok: true, provider_id: 'manual', provider: providers.get('manual'), source: 'fallback', candidates: [] };
  }

  const topScore = scored[0].score;
  const top = scored.filter((item) => item.score === topScore);
  if (top.length > 1) {
    return {
      ok: false,
      provider_id: null,
      reason: 'ambiguous_provider',
      candidates: top.map((item) => ({ provider_id: item.provider_id, score: item.score })),
    };
  }

  return {
    ok: true,
    provider_id: scored[0].provider_id,
    provider: scored[0].provider,
    source: 'credential_hints',
    candidates: scored.map((item) => ({ provider_id: item.provider_id, score: item.score })),
  };
}

module.exports = {
  providers,
  normalizeProvider,
  providerScore,
  resolveProvider,
};
