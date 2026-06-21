# piflow-cloud-deploy

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`piflow-cloud-deploy` provides a machine-readable cloud deployment capability for the PiFlow `deploy` stage. It exposes one stable runner and routes work to provider adapters such as `manual`, `mock`, `cloudflare`, `aws`, `gcp`, `tencent`, `aliyun`, and `custom`.

Agent instructions are in [SKILL.md](./SKILL.md).

## Install

Run the shared installer from the repository root:

```bash
node install.mjs piflow-cloud-deploy
```

Or run the compatibility wrapper from this skill directory:

```bash
node install.mjs
```

## Use

PiFlow normally calls the runner with a JSON request:

```bash
node scripts/cloud_deploy.cjs --input request.json --dry-run
```

You can also pipe JSON through stdin:

```bash
cat request.json | node scripts/cloud_deploy.cjs --dry-run
```

Run diagnostics for a project:

```bash
node scripts/doctor.cjs --project /path/to/project
```

Run provider checks for whichever cloud credentials are fully configured in PiFlow `config.env`:

```bash
node tests/integration-config-env-providers.cjs
```

This command only runs validate/plan dry-runs and does not print secret values.

## Providers

| Provider | Status |
| --- | --- |
| `manual` | Validates and records user-provided URLs. |
| `mock` | Deterministic local provider for tests and dry-runs. |
| `cloudflare` | Supports validation, planning, diagnostics, and guarded deployment actions. |
| `aws` | Supports validation, planning, diagnostics, dry-run, and guarded real deployment through explicit project commands. |
| `gcp` | Supports validation, planning, diagnostics, dry-run, and guarded real deployment through explicit project commands. |
| `tencent` | Supports validation, planning, diagnostics, dry-run, and guarded real deployment through Tencent Cloud CLI commands/templates. |
| `aliyun` | Supports validation, planning, diagnostics, dry-run, and guarded real deployment through Alibaba Cloud CLI commands/templates. |
| `custom` | Supports project-defined commands or external adapters while preserving the same PiFlow request/result contract. |

Real destructive deploy operations must be explicitly authorized by PiFlow via the request context. Missing credentials or tools return `status=blocked` with actionable guidance.

The config-env integration test is safe by default and only runs `validate`/`plan` dry-runs for providers whose required keys are complete in PiFlow `config.env`:

```bash
node tests/integration-config-env-providers.cjs
```

To run a guarded real deploy smoke, explicitly opt in and provide the provider command to execute. The command can wrap Terraform, an official cloud CLI, or a project deploy script:

```bash
PIFLOW_CLOUD_DEPLOY_REAL=1 \
PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_CUSTOM="npm run deploy:custom" \
node tests/integration-config-env-providers.cjs
```

Provider-specific commands use `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_<PROVIDER>`, for example `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_CLOUDFLARE` or `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_TENCENT`.

For real provider deployment, configure explicit provider commands in `piflow_runtime/cloud/deploy.json`:

```json
{
  "deploy": {
    "provider": "aws",
    "aws": {
      "commands": ["npm run deploy:aws"]
    }
  }
}
```

The same command contract works for Cloudflare Wrangler, AWS CLI/CDK/Terraform/SST, GCP `gcloud`/Firebase/Terraform, or per-service `deploy_command` entries. `finalize_commands` and `rollback_commands` are supported for operation-specific post-deploy and rollback actions.

When enough service metadata is present, the provider adapters can synthesize common official CLI commands:

| Provider | Built-in command templates |
| --- | --- |
| `cloudflare` | Wrangler Pages deploy, Workers deploy, D1 migrations apply, KV/R2/Queues creation, Workers secrets/vars, DNS records, Workers routes/domains, Pages domains |
| `aws` | S3 sync, CloudFront invalidation, Lambda update-function-code, App Runner update-service |
| `gcp` | Cloud Run deploy, Firebase Hosting deploy, GCS rsync |
| `tencent` | COS sync, CDN purge, SCF deploy, TCB framework deploy |
| `aliyun` | OSS sync, CDN refresh, Function Compute deploy, SAE deploy |
| `custom` | Project commands, external adapter commands, provider-specific probe/finalize/rollback hooks |
