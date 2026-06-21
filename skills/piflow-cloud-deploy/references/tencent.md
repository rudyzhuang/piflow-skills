# Tencent Cloud Provider

Tencent Cloud capabilities:

- COS static site/object sync
- CDN cache purge
- SCF/serverless API deploy
- TCB framework deploy
- Explicit provider/service commands
- Finalize and rollback commands

Required credential hints:

- `TENCENTCLOUD_SECRET_ID`
- `TENCENTCLOUD_SECRET_KEY`
- `TENCENTCLOUD_REGION`

Built-in command synthesis:

- COS/static site: `artifact_path` plus `tencent.bucket`; optional `tencent.cdn_url` or `tencent.cdn_paths`
- SCF/API: `tencent.function_name` plus optional `artifact_path`
- TCB/container: `tencent.env_id`
