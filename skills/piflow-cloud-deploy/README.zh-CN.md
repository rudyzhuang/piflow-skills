# piflow-cloud-deploy

英文版文档见 [README.md](./README.md)。

`piflow-cloud-deploy` 为 PiFlow 的 `deploy` 阶段提供机器可调用的云部署能力。它暴露一个稳定 runner，并把实际工作分发到 `manual`、`mock`、`cloudflare`、`aws`、`gcp`、`tencent`、`aliyun`、`custom` 等 provider adapter。

Agent 指令见 [SKILL.md](./SKILL.md)。

## 安装

在仓库根目录运行统一安装器：

```bash
node install.mjs piflow-cloud-deploy
```

也可以在本 skill 目录运行兼容 wrapper：

```bash
node install.mjs
```

## 使用

PiFlow 通常会用 JSON request 调用 runner：

```bash
node scripts/cloud_deploy.cjs --input request.json --dry-run
```

也支持从 stdin 读取 JSON：

```bash
cat request.json | node scripts/cloud_deploy.cjs --dry-run
```

诊断项目云部署环境：

```bash
node scripts/doctor.cjs --project /path/to/project
```

根据 PiFlow `config.env` 中已完整填写凭证的云平台自动执行 provider 检查：

```bash
node tests/integration-config-env-providers.cjs
```

该命令只执行 validate/plan dry-run，不会打印 secret 值。

## Provider

| Provider | 状态 |
| --- | --- |
| `manual` | 校验并登记用户配置的 URL。 |
| `mock` | 用于测试和 dry-run 的确定性本地 provider。 |
| `cloudflare` | 支持校验、计划、诊断和受保护部署动作。 |
| `aws` | 支持校验、计划、诊断、dry-run，以及通过显式项目命令执行受保护真实部署。 |
| `gcp` | 支持校验、计划、诊断、dry-run，以及通过显式项目命令执行受保护真实部署。 |
| `tencent` | 支持校验、计划、诊断、dry-run，以及通过腾讯云 CLI 命令/模板执行受保护真实部署。 |
| `aliyun` | 支持校验、计划、诊断、dry-run，以及通过阿里云 CLI 命令/模板执行受保护真实部署。 |
| `custom` | 支持项目自定义命令或外部 adapter，同时保持 PiFlow request/result 合同不变。 |

真实破坏性部署必须由 PiFlow 在 request context 中显式授权。凭证或工具缺失时返回 `status=blocked`，并给出可操作建议。

`config.env` 集成测试默认是安全的，只会对 PiFlow `config.env` 中必需 key 齐全的 provider 运行 `validate` / `plan` dry-run：

```bash
node tests/integration-config-env-providers.cjs
```

如需执行受保护真实部署 smoke，必须显式开启 real 模式并提供要执行的 provider 命令。该命令可以包装 Terraform、官方云 CLI 或项目部署脚本：

```bash
PIFLOW_CLOUD_DEPLOY_REAL=1 \
PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_CUSTOM="npm run deploy:custom" \
node tests/integration-config-env-providers.cjs
```

provider 专属命令使用 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_<PROVIDER>`，例如 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_CLOUDFLARE` 或 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_TENCENT`。

真实 provider 部署需要在 `piflow_runtime/cloud/deploy.json` 中显式配置 provider 命令：

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

同一命令合同可用于 Cloudflare Wrangler、AWS CLI/CDK/Terraform/SST、GCP `gcloud`/Firebase/Terraform，或每个 service 的 `deploy_command`。`finalize_commands` 与 `rollback_commands` 可用于 operation-specific 的收尾和回滚动作。

当 service 元数据足够时，provider adapter 可以自动合成常见官方 CLI 命令：

| Provider | 内建命令模板 |
| --- | --- |
| `cloudflare` | Wrangler Pages deploy、Workers deploy、D1 migrations apply、KV/R2/Queues 创建、Workers secrets/vars、DNS records、Workers routes/domains、Pages domains |
| `aws` | S3 sync、CloudFront invalidation、Lambda update-function-code、App Runner update-service |
| `gcp` | Cloud Run deploy、Firebase Hosting deploy、GCS rsync |
| `tencent` | COS sync、CDN purge、SCF deploy、TCB framework deploy |
| `aliyun` | OSS sync、CDN refresh、Function Compute deploy、SAE deploy |
| `custom` | 项目命令、外部 adapter 命令、provider 专属 probe/finalize/rollback hook |
