---
title: piflow-cloud-deploy skill 新增完整方案
版本: 1.0.0
文档状态: 已评审
代码实现: 部分执行
实现文档版本: 0.1.0
创建时间: 2026-06-21 15:42
修改时间: 2026-06-21 16:45
作者: Codex
评审轮次: 1
评审结果: 通过
来源上下文:
  - 用户要求在 /Users/guodongzhuang/github/piflow-skills/ 生成新增 skill 方案
  - 用户要求参考其他 skill 的 version、README、install 等规则
  - 用户要求 deploy 具体云平台流程独立为 skill，并支持按 cloud.env 自动选择云平台
  - README.md
  - install.mjs
  - skills/*/SKILL.md
  - skills/*/VERSION
  - skills/*/README.md
  - skills/*/CHANGELOG.md
---

# piflow-cloud-deploy skill 新增完整方案

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 当前状态与约束](#2-当前状态与约束)
- [3. 方案概述](#3-方案概述)
- [4. 详细设计](#4-详细设计)
- [5. 实施计划](#5-实施计划)
- [6. 兼容性与迁移](#6-兼容性与迁移)
- [7. 测试与验收](#7-测试与验收)
- [8. 风险与回滚](#8-风险与回滚)
- [9. 评审记录](#9-评审记录)

## 1. 背景与目标

### 背景

- `piflow-skills` 仓库当前通过根目录 `install.mjs` 发现 `skills/<skill-name>/`，并要求每个可安装 skill 包含 `SKILL.md`、`VERSION`、`CHANGELOG.md`、`README.md`、`README.zh-CN.md` 和 `install.mjs`。
- PiFlow deploy stage 计划把云平台部署实现外置为 skill，因此需要一个可安装、可版本化、可被 PiFlow 以 JSON 合同调用的 cloud deploy skill。
- 云平台差异很大：Cloudflare 的 Pages/Workers/D1/DNS 与 AWS/GCP 的资源模型不同，单纯在 PiFlow stage 内用参数分支扩展会难以维护。

### 目标

- 新增 `skills/piflow-cloud-deploy/`，作为 PiFlow deploy stage 的云部署能力 skill。
- 支持 `validate`、`plan`、`deploy`、`probe`、`finalize`、`rollback` 等完整操作，不只做最小部署。
- 支持 provider 自动选择：读取 PiFlow 传入的 provider resolution，也可基于 `cloud.env` effective env 和 manifest 做二次校验。
- 内置 provider adapter：`manual`、`cloudflare`、`aws`、`gcp`；预留 `azure`、`vercel`、`custom`。
- 严格遵守 piflow-skills 的安装、版本、README、CHANGELOG、agent metadata 和脚本组织规则。

### 非目标

- 不让 skill 直接修改 PiFlow pipeline 顺序或决定 recovery 重跑。
- 不把所有 provider 写成一个巨大的 `SKILL.md`；provider 细节放到 references 或 scripts 中按需加载/执行。
- 不在 skill 文档中保存任何真实云凭证或项目 secret。

## 2. 当前状态与约束

### 当前状态

- 现有 skills 都放在 `skills/<name>/`，根安装器负责安装到 Cursor、Codex、OpenCode 和 Claude Code。
- 根安装器校验必需文件，skill-local `install.mjs` 是调用根安装器的兼容 wrapper。
- 多数 skill 使用 `agents/openai.yaml` 作为 UI 元数据，并通过 `README.md` / `README.zh-CN.md` 描述安装与使用。
- 部分 skill 使用 `scripts/` 承载确定性逻辑，例如 `piflow-status-inspector/scripts/project_status.cjs`。

### 约束

- 新 skill 名称使用小写 hyphen：`piflow-cloud-deploy`。
- 首版版本建议为 `0.1.0`，后续 provider 能力变更记录到 `CHANGELOG.md`。
- `SKILL.md` 需要保持精炼，只放工作流、输入输出合同和 reference 路由；provider 详细策略放到 `references/`。
- 可执行部署逻辑应优先放到 `scripts/cloud_deploy.cjs` 与 provider adapter 脚本，减少 Agent 手写云 API 调用。
- skill 的 machine interface 必须稳定，供 PiFlow 自动调用。

### 假设

- PiFlow 会通过 `node skills/piflow-cloud-deploy/scripts/cloud_deploy.cjs --input <json>` 或 stdin JSON 调用本 skill。
- Provider adapter 可优先使用官方 CLI 或 REST API；真实 SDK 依赖必须在 README 和 doctor 输出中说明。
- Cloudflare adapter 首先迁移现有 PiFlow 逻辑，AWS/GCP adapter 可从完整合同和 mock provider 起步。

## 3. 方案概述

- 建立一个主 skill：`piflow-cloud-deploy`，对外暴露统一部署合同。
- Provider 不拆成多个平级主 skill；在主 skill 内用 `providers/<provider>.cjs`、`references/<provider>.md` 和 provider manifest 隔离实现。
- 原因是 PiFlow 需要一个稳定入口来安装、发现、调用和版本约束；provider 差异通过 adapter 隔离，避免用户需要为一个 deploy stage 同时安装多个 skill。
- 当某个 provider 复杂到需要独立生命周期时，再新增 companion skill，例如 `piflow-cloud-deploy-aws-enterprise`，但它仍实现同一 machine contract。

## 4. 详细设计

### 目录结构

```text
skills/piflow-cloud-deploy/
  SKILL.md
  VERSION
  CHANGELOG.md
  README.md
  README.zh-CN.md
  install.mjs
  agents/
    openai.yaml
  references/
    contract.md
    provider-resolution.md
    cloudflare.md
    aws.md
    gcp.md
    manual.md
    custom-provider.md
  scripts/
    cloud_deploy.cjs
    doctor.cjs
    redact.cjs
    providers/
      registry.cjs
      manual.cjs
      cloudflare.cjs
      aws.cjs
      gcp.cjs
      mock.cjs
  schemas/
    cloud-deploy-request.schema.json
    cloud-deploy-result.schema.json
    provider-manifest.schema.json
  tests/
    self-test-cloud-deploy-contract.cjs
    fixtures/
```

### SKILL.md 要点

- 触发描述覆盖：PiFlow deploy、云部署、Cloudflare/AWS/GCP/manual provider、`piflow_runtime/cloud`、`cloud.env`、部署失败 triage、provider migration。
- Body 保留核心流程：
  - 定位项目根和 `piflow_runtime/cloud`
  - 读取 PiFlow 传入 request，而不是自行扫描所有项目
  - 根据 operation 调用脚本
  - 输出 JSON result，失败时输出结构化 failure context
  - provider 细节按需读取 references
- 明确安全规则：
  - 不回显完整 token
  - 不把 secret 写入 deploy.json
  - destructive 操作必须依赖 PiFlow 传入授权

### README / README.zh-CN

- 说明 skill 用途、安装、PiFlow 自动调用方式、手动调试方式。
- 安装示例：
  - `node install.mjs piflow-cloud-deploy`
  - `cd skills/piflow-cloud-deploy && node install.mjs`
- 手动 dry-run 示例：
  - `node scripts/cloud_deploy.cjs --input request.json --dry-run`
  - `node scripts/doctor.cjs --project /path/to/project`
- Provider 依赖说明：
  - Cloudflare：Wrangler 或 Cloudflare API token
  - AWS：AWS CLI/环境凭证或 REST adapter
  - GCP：gcloud/服务账号或 REST adapter
  - manual：无需云 CLI

### VERSION 与 CHANGELOG

- `VERSION` 初始为 `0.1.0`。
- `CHANGELOG.md` 初始记录：
  - Added: piflow-cloud-deploy skill skeleton
  - Added: JSON request/result contract
  - Added: provider registry and manual/cloudflare/aws/gcp adapter design
  - Added: secret redaction and doctor command
- 后续每次 provider capability 变化必须更新 `VERSION` 与 changelog。

### install.mjs 与 agents/openai.yaml

- `install.mjs` 使用现有 skill-local wrapper 模式，调用仓库根 `install.mjs`。
- `agents/openai.yaml` 应包含：
  - `display_name: PiFlow Cloud Deploy`
  - `short_description: Deploy PiFlow services through provider-specific cloud adapters.`
  - `default_prompt` 描述按 `piflow_runtime/cloud/cloud.env` 和 deploy request 执行 provider 部署。
- 根 `README.md` 的 Current Skills 表格需要新增一行。

### Provider adapter 合同

Provider adapter 导出：

```js
module.exports = {
  manifest,
  validate(ctx),
  plan(ctx),
  deploy(ctx),
  probe(ctx),
  finalize(ctx),
  rollback(ctx),
};
```

Manifest 字段：

| 字段 | 说明 |
| --- | --- |
| `provider_id` | `cloudflare` / `aws` / `gcp` / `manual` |
| `service_types` | 支持 `static_site`、`serverless_api`、`worker`、`container`、`database`、`storage`、`queue`、`gateway` |
| `capabilities` | `deploy`、`dns`、`custom_domain`、`secrets`、`migrations`、`cors`、`rollback` |
| `credential_hints` | 用于 provider 自动检测 |
| `required_permissions` | 用于 blocked user actions 和报告 |

### Provider 能力边界

| Provider | 首版完整合同 |
| --- | --- |
| `manual` | 校验用户提供 URL、登记 outputs、跳过云部署、支持 probe/smoke |
| `cloudflare` | Pages、Workers、D1、R2、KV、Queues、DNS、routes、custom domains、Workers secrets、D1 migrations、CORS、gateway routing |
| `aws` | S3/CloudFront 静态站、Lambda/API Gateway 或 ECS/App Runner API、Route53/ACM、Secrets Manager、健康探针、rollback plan |
| `gcp` | Cloud Run/API、Cloud Storage/Firebase Hosting 静态站、Cloud DNS、Secret Manager、健康探针、rollback plan |
| `custom` | 项目侧命令或外部 adapter manifest，必须实现同一 JSON result |

## 5. 实施计划

### 阶段 1: Skill 骨架与安装规则

- 创建 `skills/piflow-cloud-deploy/` 必需文件。
- 更新根 `README.md` / `README.zh-CN.md` 的 skill 列表。
- 增加 `agents/openai.yaml`。
- 验证：根安装器 dry-run 能发现并校验该 skill。

### 阶段 2: 合同、schema 与 runner

- 实现 request/result/provider manifest schema。
- 实现 `scripts/cloud_deploy.cjs` 支持 stdin、`--input`、`--json`、`--dry-run`。
- 实现 `redact.cjs` 与 failure context 归一化。
- 验证：contract self-test 覆盖 schema valid/invalid、脱敏、operation dispatch。

### 阶段 3: Provider registry 与 manual/mock

- 实现 provider registry、manual provider、mock provider。
- 支持 provider resolution 校验和 capability 校验。
- 验证：不需要真实云凭证即可完成 CI 自测。

### 阶段 4: Cloudflare 等价能力

- 迁移或封装 PiFlow 现有 Cloudflare 能力为 adapter。
- 覆盖 Pages/Workers/DNS/routes/D1/secrets/CORS/gateway。
- 验证：用 PiFlow 现有 Cloudflare fixture 和 self-test 做等价验证。

### 阶段 5: AWS/GCP 完整 adapter

- AWS/GCP 先实现完整 contract、doctor、plan、dry-run、mock deploy，再逐步接真实 API。
- 每个真实 provider 操作必须支持 plan 输出和权限缺失 blocked 输出。
- 验证：mock 自测默认运行，真实集成测试通过显式环境变量开启。

### 依赖与排期

- 依赖 PiFlow 侧先固化 JSON contract 和 skill runner。
- Cloudflare adapter 与 PiFlow deploy stage 抽取应联动推进。
- AWS/GCP 可在 Cloudflare 等价迁移后并行落地。

## 6. 兼容性与迁移

- 旧项目不安装该 skill 时，PiFlow 可继续走 legacy Cloudflare adapter。
- 安装该 skill 后，PiFlow provider registry 优先使用 skill manifest。
- `piflow_runtime/cloud/cloud.env` 继续作为凭证入口，skill 不改变 env 文件格式。
- `piflow_runtime/cloud/deploy.json` 是结构化配置入口，skill 只读取 PiFlow 传入的合并 request，不自行写回项目配置，除非 operation 明确是 migration。
- Provider adapter 输出必须兼容旧 `deploy.outputs.services[]` 字段。

## 7. 测试与验收

### 测试计划

- `node install.mjs piflow-cloud-deploy --dry-run`
- `node skills/piflow-cloud-deploy/scripts/cloud_deploy.cjs --input tests/fixtures/manual-request.json --dry-run`
- `node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`
- `node skills/piflow-cloud-deploy/scripts/doctor.cjs --project <fixture>`
- 根安装器必需文件校验覆盖新 skill。
- Provider mock matrix 覆盖 `manual/cloudflare/aws/gcp/custom`。

### 验收标准

- 新 skill 满足根安装器必需文件规则。
- README、README.zh-CN、CHANGELOG、VERSION、install.mjs、agents/openai.yaml 完整。
- `SKILL.md` 精炼，provider 细节通过 references 分流。
- machine runner 能稳定读入 request JSON 并输出 result JSON。
- secret redaction 通过测试。
- manual/mock provider 无真实云凭证也可跑通。
- Cloudflare adapter 能覆盖 PiFlow 当前 Cloudflare 功能合同。
- AWS/GCP adapter 至少具备 plan、validate、doctor、mock deploy 和完整权限说明。

## 8. 风险与回滚

### 风险

- 一个主 skill 过大：provider 细节膨胀；缓解措施是 SKILL.md 只放路由，provider 实现放 scripts/references，复杂 provider 后续拆 companion。
- Provider adapter 依赖本机 CLI：不同机器表现不一致；缓解措施是 doctor 输出清晰依赖，真实集成测试需显式开启。
- JSON contract 演进破坏 PiFlow 调用：缓解措施是 `api_version` 强制校验，保留 v1 兼容。
- 真实部署误操作：缓解措施是 dry-run/plan 优先，destructive 授权由 PiFlow 传入，skill 不自行放宽。

### 回滚

- 从根 README 和安装器可见列表移除该 skill，不影响其它 skill。
- PiFlow 可回退 legacy deploy adapter，不调用 `piflow-cloud-deploy`。
- Provider adapter 可按 manifest 禁用单个 provider。
- 已安装用户可重新运行 `node install.mjs <skill>` 覆盖或删除目标 agent skill 目录。

## 9. 评审记录

### 第 1 轮评审

- 结论: 通过
- 发现:
  - 方案符合 piflow-skills 现有安装规则，明确列出必需文件、版本、README、CHANGELOG、install wrapper 和 agents metadata。
  - 推荐单主 skill + provider adapter，而不是多个平级 provider 主 skill，能保证 PiFlow 调用入口稳定，同时通过 adapter 隔离 provider 复杂度。
  - 方案覆盖完整功能面，包括 contract、schema、runner、doctor、redaction、mock provider、Cloudflare 等价迁移、AWS/GCP 扩展和 rollback。
- 修改:
  - 已补充 provider manifest、machine runner、doctor、自测矩阵、secret redaction 和 companion skill 扩展边界。
- 复审确认:
  - 本轮基于最新讨论内容执行，未发现阻塞问题。

### 执行记录 2026-06-21 16:20

- 结论: 部分执行
- 已完成:
  - 新增 `skills/piflow-cloud-deploy/` 必需文件：`SKILL.md`、`VERSION`、`CHANGELOG.md`、`README.md`、`README.zh-CN.md`、`install.mjs`、`agents/openai.yaml`。
  - 新增 JSON contract schema、provider manifest schema、contract/provider references、manual/cloudflare/aws/gcp/custom provider 文档。
  - 实现 `scripts/cloud_deploy.cjs`、`doctor.cjs`、secret redaction、provider registry、manual/mock provider，以及 Cloudflare/AWS/GCP 的 validate/plan/blocked adapter 框架。
  - 同步根 `README.md` / `README.zh-CN.md` 的 Current Skills 列表与安装说明。
  - 新增并通过 `tests/self-test-cloud-deploy-contract.cjs`，并通过脚本语法检查和根安装器 dry-run。
- 未完成:
  - 尚未把 Cloudflare 等价迁移为真实 adapter。
  - 尚未实现 AWS/GCP 资源拓扑级真实云 API 部署模板。
  - 尚未实现 rollback/finalize 的真实 provider 执行与真实云集成测试。

### 执行记录 2026-06-21 16:45

- 结论: 继续部分执行
- 已完成:
  - 根据新增要求补充腾讯云 `tencent` 与阿里云 `aliyun` provider，包含 provider registry、凭证 hint、validate/plan/deploy/finalize/rollback、显式命令、内建 CLI 模板、doctor 展示、README 与 references。
  - 新增 `tests/integration-config-env-providers.cjs`，自动读取 `/Users/guodongzhuang/github/piflow/config.env` 或 `PIFLOW_CONFIG_ENV_PATH`，只对必需 key 完整的云平台执行 validate/plan dry-run，并且不输出 secret。
  - 腾讯云模板覆盖 COS sync、CDN purge、SCF deploy、TCB framework deploy；阿里云模板覆盖 OSS sync、CDN refresh、Function Compute deploy、SAE deploy。
  - Cloudflare/AWS/GCP adapter 新增显式 provider command 真实执行路径：当 PiFlow 传入 destructive 授权并且项目配置 `deploy.<provider>.commands`、`deploy.commands` 或 `deploy.services[].deploy_command` 时，skill 会执行真实项目命令。
  - 未配置真实部署命令时返回 provider-specific blocked reason，例如 `aws_deploy_command_missing` / `gcp_deploy_command_missing`，避免猜测资源拓扑。
  - 命令 stdout/stderr tail 新增基于 effective env 的 secret redaction，避免云 CLI 输出泄漏 token/secret。
  - `finalize` / `rollback` 新增 operation-specific 命令解析，支持 `deploy.<provider>.finalize_commands`、`deploy.<provider>.rollback_commands`、`deploy.services[].rollback_command` 等真实执行路径。
  - Cloudflare/AWS/GCP 新增内建官方 CLI 命令模板：Wrangler Pages/Workers/D1、AWS S3/CloudFront/Lambda/App Runner、GCP Cloud Run/Firebase/GCS；plan 输出 `metadata.planned_commands`。
  - Cloudflare adapter 继续补齐 legacy 资源细节模板：KV/R2/Queues/D1 resource creation、Workers secrets/vars、DNS records、Workers routes/domains、Pages domains、CORS allowed origins 与 gateway pages origins。
  - README、README.zh-CN 和 provider references 已同步显式命令部署合同和 Cloudflare 资源模板字段。
  - `tests/self-test-cloud-deploy-contract.cjs` 覆盖 AWS command deploy 成功路径、rollback 独立命令路径、命令输出 secret 脱敏、Cloudflare/AWS/GCP/Tencent/Aliyun 内建命令模板、Cloudflare 资源/DNS/route/domain/CORS/gateway 模板和 planned_commands；`integration-config-env-providers.cjs` 当前按 `config.env` 自动选择并验证 `cloudflare`、`tencent`。
- 未完成:
  - 尚未提供真实云账号下的集成测试证据。

## 2026-06-21 补充执行记录：按 PiFlow config.env 可用凭证选择 provider 集成测试

- 已增加并验证 `tests/integration-config-env-providers.cjs`：读取 `/Users/guodongzhuang/github/piflow/config.env`，只对必需凭证完整的云平台运行 skill 的 `validate`/`plan` dry-run。
- 本轮实际选择 provider：`cloudflare`、`tencent`。
- 本轮跳过 provider：`aliyun`、`aws`、`gcp`，原因是对应必需 key 未在 `config.env` 中完整提供。
- 验证结果：`cloudflare`、`tencent` 均返回 `status=completed`，各生成 1 条计划命令；未执行真实部署。

## 2026-06-21 补充执行记录：custom provider adapter 落地

- 已新增 `scripts/providers/custom.cjs`，支持项目自定义命令和外部 adapter 命令，覆盖 `validate`、`plan`、`deploy`、`probe`、`finalize`、`rollback`，并继续使用 PiFlow request/result 合同和 destructive 授权门闸。
- 已将 `custom` 注册进 provider registry，并支持 `project-script` / `external-provider` 别名归一化。
- 已更新根 README、中文 README、skill README、中文 skill README 与 CHANGELOG，使 provider 列表与当前实现一致：`manual`、`mock`、`cloudflare`、`aws`、`gcp`、`tencent`、`aliyun`、`custom`。
- 已修复 `doctor.cjs` 参数兼容，支持方案中写法 `--project /path`，也继续支持 `--project=/path`。
- 本轮验证通过：`node --check skills/piflow-cloud-deploy/scripts/providers/custom.cjs`、`node --check skills/piflow-cloud-deploy/scripts/providers/registry.cjs`、`node --check skills/piflow-cloud-deploy/scripts/doctor.cjs`、`node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`、`node skills/piflow-cloud-deploy/scripts/doctor.cjs --project /tmp --json`、`node skills/piflow-cloud-deploy/tests/integration-config-env-providers.cjs`。

## 2026-06-21 补充执行记录：安装规则与 provider manifest 验证补齐

- 已增强 `self-test-cloud-deploy-contract.cjs`，统一校验所有 provider manifest 的必填字段、类型、`validate` / `plan` handler，以及 provider 集合 `manual`、`mock`、`cloudflare`、`aws`、`gcp`、`tencent`、`aliyun`、`custom`。
- 已增强 `integration-config-env-providers.cjs`：当 `custom` 因 `PIFLOW_CUSTOM_CLOUD_PROVIDER` 被选中时，fixture 会提供项目自定义命令，并要求非 manual provider 至少产出 1 条 `planned_commands`，避免空计划伪通过。
- 已执行根安装器 dry-run：`node install.mjs piflow-cloud-deploy --dry-run --all`，确认 skill 满足必需文件规则，并可匹配 Cursor、Codex、OpenCode、Claude Code 以及 Codex plugin marketplace 安装路径。
- 本轮验证通过：`node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`、`node skills/piflow-cloud-deploy/tests/integration-config-env-providers.cjs`、`node install.mjs piflow-cloud-deploy --dry-run --all`。

## 2026-06-21 补充执行记录：runner CLI 参数与 dry-run 语义修复

- 已修复 `scripts/cloud_deploy.cjs` 参数解析，支持 README/方案中写法 `--input request.json` 和 `--project /path`，同时保留 `--input=request.json` / `--project=/path`。
- 已补充 contract self-test 覆盖 runner 参数解析，防止文档示例退化成默认 doctor 操作。
- 已修复 manual provider 的 dry-run 语义：`--dry-run` 下 service 输出为 `status=planned` 且 `metadata.dry_run=true`，不再误标为已部署。
- 本轮验证通过：`node --check skills/piflow-cloud-deploy/scripts/cloud_deploy.cjs`、`node --check skills/piflow-cloud-deploy/scripts/providers/manual.cjs`、`node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`、`node skills/piflow-cloud-deploy/scripts/cloud_deploy.cjs --input skills/piflow-cloud-deploy/tests/fixtures/manual-request.json --dry-run`。

## 2026-06-21 补充执行记录：被 PiFlow 真实 orchestrator 调用验证

- 已通过 PiFlow 侧新增的 `self-test-cloud-deploy-skill-integration.cjs` 验证本 skill 可被真实 `cloud-skill-runner` 发现并调用。
- 验证路径使用 `custom` provider 和无害本地 Node 命令，覆盖 skill 的 JSON stdin/stdout 合同、provider resolution、destructive 授权、命令执行与 service result 输出。
- 同步复跑 skill contract 与按 `config.env` 选择 provider 的 dry-run 集成测试；当前仍自动选择 `cloudflare`、`tencent`。
- 本轮验证通过：PiFlow 侧 `node scripts/self-test/self-test-cloud-deploy-skill-integration.cjs`，skill 侧 `node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`、`node skills/piflow-cloud-deploy/tests/integration-config-env-providers.cjs`。

## 2026-06-21 补充执行记录：operation 枚举合同收紧

- 已在 `scripts/cloud_deploy.cjs` 增加 `VALID_OPERATIONS`，明确允许 `validate`、`plan`、`deploy`、`probe`、`finalize`、`rollback`、`doctor`。
- 未知 operation 现在返回 `invalid_request` / `unsupported operation`，不再静默降级为 provider `validate`。
- 已扩展 contract self-test 覆盖 operation 枚举和未知 operation 拒绝行为；按 `config.env` 自动选择 provider 的 dry-run 集成测试继续通过。
- 本轮验证通过：`node --check skills/piflow-cloud-deploy/scripts/cloud_deploy.cjs`、`node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`、`node skills/piflow-cloud-deploy/tests/integration-config-env-providers.cjs`。

## 2026-06-21 补充执行记录：provider hint group 选择边界补测

- 已扩展 `self-test-cloud-deploy-contract.cjs`，覆盖 partial cloud hint 与 complete custom hint 同时存在时的选择行为。
- skill registry 使用完整 credential hint group 计分：腾讯云只提供 `TENCENTCLOUD_SECRET_ID` 时不会成为完整候选；若 `PIFLOW_CUSTOM_CLOUD_PROVIDER` 完整存在，则自动选择 `custom`，避免 partial 云凭证误导 provider resolution。
- 已保留既有 Cloudflare/GCP 完整凭证同分 ambiguous 测试，覆盖多完整候选冲突必须 blocked 的边界。
- 本轮验证通过：`node skills/piflow-cloud-deploy/tests/self-test-cloud-deploy-contract.cjs`。

## 2026-06-21 补充执行记录：受保护 real deploy 集成模式

- 已扩展 `tests/integration-config-env-providers.cjs`：默认仍只对 PiFlow `config.env` 中必需 key 齐全的 provider 执行 `validate` / `plan` dry-run，并输出 `real_deploy_enabled=false`。
- 新增受保护 real deploy 模式：设置 `PIFLOW_CLOUD_DEPLOY_REAL=1` 后，若存在 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_<PROVIDER>` 或通用 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND`，脚本会对该 provider 执行 `operation=deploy`，并要求产生 `command_results`。
- 已更新 README、README.zh-CN 与 CHANGELOG，记录 real deploy smoke 的显式开关和 provider-specific command 环境变量。
- 本轮验证通过：默认 dry-run 选择 `cloudflare`、`tencent`；临时 custom config + `PIFLOW_CLOUD_DEPLOY_REAL=1` + 无害本地 Node 命令执行 `custom` real-mode deploy 并返回 1 条 command result。

## 2026-06-21 阻塞记录：真实云 destructive 集成测试待授权

- 当前 `piflow-cloud-deploy` skill 的安装规则、README/CHANGELOG、provider registry、manual/mock/cloudflare/aws/gcp/tencent/aliyun/custom adapters、schema、doctor、runner、secret redaction、operation/result 合同、config-env selected provider dry-run、custom real-mode 本地命令验证均已落地。
- 剩余唯一硬缺口是真实云 destructive 集成测试：必须由用户明确允许对目标云 provider 执行真实 deploy 命令。
- 可执行命令形态：`PIFLOW_CLOUD_DEPLOY_REAL=1 PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_<PROVIDER>="<真实部署命令>" node tests/integration-config-env-providers.cjs`。
- 当前默认 dry-run 会根据 PiFlow 根 `config.env` 自动选择 `cloudflare`、`tencent`；真实云验证需要提供 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_CLOUDFLARE` 或 `PIFLOW_CLOUD_DEPLOY_REAL_COMMAND_TENCENT`，或补齐其它 provider key 后提供对应命令。
- 在未获得显式授权前，不执行真实云 destructive 操作，方案保持 `部分执行`，阻塞项为 `real_cloud_destructive_deploy_authorization_required`。
