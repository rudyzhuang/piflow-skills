# Changelog

## 0.1.1 - 2026-06-21

- 提交 piflow-cloud-deploy skill 相关内容
- Changed: 37 file(s).
- Areas: skills(36), docs(1).
- Hints: initial or bulk add, scripts/tests, documentation, spec/templates.
- Added: 37, Modified: 0, Deleted: 0.

## 0.1.0 - 2026-06-21

- Added initial `piflow-cloud-deploy` skill.
- Added JSON request/result contract for PiFlow deploy stage integration.
- Added provider registry with manual, mock, Cloudflare, AWS, GCP, Tencent Cloud, Alibaba Cloud, and custom adapters.
- Added secret redaction, doctor command, schemas, fixtures, and contract self-test.
- Added guarded real-deploy integration mode for config-env selected providers via `PIFLOW_CLOUD_DEPLOY_REAL=1` and provider-specific command environment variables.
