---
name: piflow-cloud-deploy
description: Execute, validate, plan, diagnose, or dry-run PiFlow cloud deployments through provider-specific adapters. Use when the user asks about PiFlow deploy stage cloud deployment, piflow_runtime/cloud/deploy.json, cloud.env provider selection, Cloudflare/AWS/GCP/manual deploy adapters, deploy doctor, provider migration, or machine-readable cloud deploy requests/results.
---

# PiFlow Cloud Deploy

## Purpose

Provide a stable cloud deployment capability for PiFlow's `deploy` stage. PiFlow should call this skill through `scripts/cloud_deploy.cjs` with a JSON request. The skill returns a JSON result with normalized services, actions, probe/smoke metadata, and failure context.

## Core Rules

- Treat PiFlow's JSON request as the source of truth. Do not scan unrelated projects.
- Never print full secrets. Use `scripts/redact.cjs` for logs, diagnostics, and JSON output.
- Do not write credentials to `piflow_runtime/cloud/deploy*.json`, reports, or examples.
- Destructive operations require PiFlow to pass `run_context.explicit_confirm=true` or equivalent authorization.
- Provider-specific details live in `references/` and `scripts/providers/`; keep this file focused on the workflow.
- If provider selection is ambiguous, return `status=blocked` with `user_actions[]`.

## Workflow

1. Locate the request.
   - Prefer `node scripts/cloud_deploy.cjs --input <file>`.
   - If no `--input` is provided, read JSON from stdin.
   - Optional flags: `--dry-run`, `--json`, `--project=<path>`.

2. Run validation or deployment through the script:

   ```bash
   node <skill-dir>/scripts/cloud_deploy.cjs --input request.json --dry-run
   ```

3. For environment diagnostics:

   ```bash
   node <skill-dir>/scripts/doctor.cjs --project /path/to/project
   ```

4. For provider details, load only the relevant reference:
   - Contract: `references/contract.md`
   - Provider resolution: `references/provider-resolution.md`
   - Cloudflare: `references/cloudflare.md`
   - AWS: `references/aws.md`
   - GCP: `references/gcp.md`
   - Tencent Cloud: `references/tencent.md`
   - Alibaba Cloud: `references/aliyun.md`
   - Manual/custom: `references/manual.md`, `references/custom-provider.md`

## Provider Policy

The skill exposes one stable entry point, `piflow-cloud-deploy`, and isolates cloud differences behind provider adapters. Do not create separate primary skills for each cloud by default. If a provider later needs a large enterprise extension, create a companion skill that still implements the same JSON contract.

## Output Contract

Always return a JSON object with:

- `api_version`
- `provider`
- `operation`
- `status`
- `services`
- `actions`
- `user_actions`
- `metadata`
- optional `failure_context`

Use `status=blocked` for missing credentials, missing provider tools, ambiguous provider selection, or absent destructive authorization.
