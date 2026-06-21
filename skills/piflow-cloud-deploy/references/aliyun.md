# Alibaba Cloud Provider

Alibaba Cloud capabilities:

- OSS static site/object sync
- CDN refresh
- Function Compute/serverless API deploy
- SAE container deploy
- Explicit provider/service commands
- Finalize and rollback commands

Required credential hints:

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `ALIBABA_CLOUD_REGION_ID`

Built-in command synthesis:

- OSS/static site: `artifact_path` plus `aliyun.bucket`; optional `aliyun.cdn_object_path` or `aliyun.cdn_paths`
- FC/API: `aliyun.service_name` and/or `aliyun.function_name`
- SAE/container: `aliyun.app_id` plus `aliyun.image_url`
