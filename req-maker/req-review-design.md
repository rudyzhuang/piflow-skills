# req-review Skill 设计方案：从 req-md-export 生成 PiFlow req.md

## 背景

piflow-online 的运行链路中，piflow-cli 在领取 `start` 指令后需要为指定项目准备本地工作区，并生成符合 PiFlow 模板的 `inputs/req.md`。项目需求由 Backend 的 `GET /api/v1/projects/:id/req-md-export` 提供，模板来源为 `/Users/guodongzhuang/github/piflow/templates/req-template.md`。

本设计只定义 `req-review` skill 如何处理“接口返回需求数据 -> 校验 -> 渲染 req.md -> 自检”的流程，不修改现有代码。

## 目标

`req-review` 是一个给 piflow-cli 使用的需求导出与模板渲染 skill。它负责接收 Backend 返回的项目需求数据，生成严格符合 PiFlow `req-template.md` 章节结构的 Markdown 文档，并把可追溯字段保留到功能块与测试用例中。

核心目标：

- 使用 `GET /api/v1/projects/:id/req-md-export` 返回的数据作为唯一业务来源。
- 按 PiFlow 模板章节顺序生成 `inputs/req.md`。
- 保留需求追溯字段：`requirement_id`、`item_id`、`version_number`、`version_hash`、`version_status`。
- 对缺失字段使用明确默认值或空结构，不编造业务事实。
- 生成后执行结构校验、字段校验和 Markdown 自检。

## 适用范围

适用：

- piflow-cli 已领取 `start` 指令，拿到 `project_id` 和 `run_id`。
- CLI 需要从 Backend 拉取项目需求并生成本地 `inputs/req.md`。
- Backend 返回结构化 `ReqMdExportDocument` JSON，或兼容返回已渲染 Markdown。

不适用：

- 从用户自然语言、Figma Make 或产品草稿生成初始需求，这仍属于 `req-maker`。
- 修改 Admin 需求清单或回写 AI 评审状态。
- 执行 piflow 流水线命令本身。

## 上游 API

### 请求

```http
GET /api/v1/projects/:id/req-md-export
Authorization: Bearer <device_api_key>
```

路径参数：

```json
{
  "id": "project_id"
}
```

鉴权与授权要求：

- `Authorization` 必须是设备 `api_key`。
- Backend 必须确认该设备已注册且未删除。
- Backend 必须确认该设备被分配到该项目当前活跃 run。
- 未分配设备访问任意项目需求时返回 `403`。

### 错误响应

统一错误格式：

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "设备未分配到该项目，无法导出 req.md"
  }
}
```

状态码语义：

- `401`：缺少或无效 Bearer token。
- `403`：设备无权导出该项目需求。
- `404`：项目不存在或已软删除。
- `422`：`project_id` 非法。
- `500` / `503`：服务端或依赖不可用。

## 推荐响应格式：ReqMdExportDocument

`req-review` 的主路径应消费结构化 JSON，而不是直接消费 Markdown。推荐响应：

```json
{
  "template_ref": "templates/req-template.md",
  "project_name": {
    "name_zh": "piflow-online PI流水线管理平台",
    "name_en": "project_uuid_or_slug"
  },
  "project_summary": "项目简介文本",
  "agent": {
    "agent_provider": "codex",
    "agent_model": "gpt-5.5"
  },
  "client_targets": [
    {
      "target": "admin",
      "positioning": "面向唯一超级管理员的管理后台，用于项目管理、需求管理和运行控制。",
      "layout": {
        "layout_shell": "经典左侧菜单 + 右侧主内容区",
        "default_route": "/projects",
        "menu": ["项目管理", "设备管理", "系统设置"]
      }
    },
    {
      "target": "backend",
      "positioning": "面向 Admin 后台和 piflow-cli 的 REST API。",
      "layout": null
    }
  ],
  "features": [
    {
      "heading_client": "admin",
      "heading_title": "项目列表与项目基础管理",
      "requirement_id": "requirement_uuid",
      "item_id": "req-item-uuid",
      "version_number": 3,
      "version_hash": "sha256_hex",
      "version_status": "reviewed",
      "feature_id": "PROJ-MGMT-001",
      "priority": "must",
      "phase": "mvp",
      "client_targets": ["admin", "backend"],
      "description": "管理员可以新增、编辑、查看、软删除和恢复项目。",
      "user_stories": [
        "作为超级管理员，我希望维护业务项目列表，以便统一管理每个项目的 piflow 运行过程。"
      ],
      "acceptance_criteria": [
        "项目列表展示项目名称、项目状态、需求管理摘要、运行状态和审计信息。"
      ],
      "dependencies": ["AUTH-LOGIN-001"],
      "freeform_content": "可选的业务原文，仅用于追溯或 description 兜底。"
    }
  ],
  "test_cases": [
    {
      "title": "审核完成后自动分配设备并执行真实 piflow 命令",
      "feature_id": "RUN-EXEC-001",
      "client_target": "desktop",
      "type": "e2e",
      "priority": "must",
      "preconditions": ["项目所有需求清单项当前版本状态均为 reviewed。"],
      "steps": ["在项目详情点击开始。", "CLI 领取 start 指令并 ack。"],
      "expected": ["CLI 写入 inputs/req.md 后启动 piflow 命令。"],
      "test_data": ["项目 ID 使用测试项目生成的 ID。"]
    }
  ],
  "non_functional": {
    "performance": ["Admin 常规列表、详情和表单操作应快速响应。"],
    "security": ["CLI 使用设备 api_key Bearer 鉴权。"],
    "availability": [],
    "compliance": [],
    "accessibility": []
  },
  "deployment": {
    "cloud_provider": "cloudflare",
    "domain": "piflow.org"
  },
  "auth": {
    "scheme": "session",
    "description": "Admin 使用 HttpOnly session cookie；CLI 使用设备 Bearer token。"
  },
  "tech_constraints": {
    "stack_preferences": ["Cloudflare Worker", "D1", "R2"],
    "forbidden_frameworks": [],
    "third_party_limits": [],
    "repository_constraints": []
  },
  "other_notes": {
    "release_deadline": "",
    "mvp_scope": ["首版打通项目创建、需求审核、运行和 report 查看闭环。"],
    "known_risks": [],
    "notes": []
  }
}
```

## 字段约束

### 顶层字段

- `template_ref`：必须为 `templates/req-template.md`。
- `project_name.name_zh`：必填，渲染到 `项目中文名：`。
- `project_name.name_en`：必填，渲染到 `项目英文名：`，应与 `<workspace_root>/<project_id>` 的目录标识一致。
- `project_summary`：允许空字符串，不允许缺失。
- `agent.agent_provider`：缺失时默认 `codex`。
- `agent.agent_model`：缺失时默认 `gpt-5.5`。

### client_targets

`target` 枚举：

```text
website | admin | backend | mobile | desktop | miniapp
```

渲染规则：

- 每个 target 输出为 `- <target>: <positioning>`。
- 如果 target 为 `admin` 且存在 `layout`，在同一段后追加：
  - `layout_shell: ...`
  - `default_route: ...`
  - `menu: [...]`
- 不存在 `layout` 时只渲染定位描述。

### features

必填字段：

- `heading_title`
- `requirement_id`
- `item_id`
- `version_number`
- `version_hash`
- `version_status`
- `priority`
- `phase`
- `client_targets`
- `description`

枚举：

- `version_status`: `draft | ai-reviewed | reviewed`
- `priority`: `must | should | nice`
- `phase`: `mvp | v1 | later`

渲染规则：

```md
### Feature: <heading_client> 端 - <heading_title>

requirement_id: <requirement_id>
item_id: <item_id>
version_number: <version_number>
version_hash: <version_hash>
version_status: <version_status>
feature_id: <feature_id>
priority: <priority>
phase: <phase>
client_targets: [admin, backend]
description:
<description>

user_stories:
  - <story>

acceptance_criteria:
  - requirement_id: <requirement_id>
  - item_id: <item_id>
  - version_number: <version_number>
  - version_hash: <version_hash>
  - version_status: <version_status>
  - <criterion>

dependencies: [AUTH-LOGIN-001]
```

说明：

- `feature_id` 允许为空，表示新功能由后续 piflow 阶段生成；若 Backend 已提供则必须原样保留。
- `freeform_content` 不直接作为独立章节渲染；仅在 `description` 缺失时作为兜底。
- `acceptance_criteria` 应自动补入追溯字段，避免 report 无法关联需求版本。

### test_cases

渲染规则：

```md
### TC-001: <title>

feature_id: <feature_id>
client_target: <client_target>
type: <type>
priority: <priority>

preconditions:
  - <precondition>

steps:
  - <step>

expected:
  - <expected>

test_data:
  - <test_data>
```

测试类型枚举：

```text
smoke | e2e | api | regression | edge | error
```

当 `test_cases` 为空时，保留 `## 测试用例` 章节，并输出空列表占位：

```md
## 测试用例

-
```

## 输出 req.md 模板结构

`req-review` 必须生成以下顶层章节，顺序与模板一致：

```text
# 项目需求说明
## 项目名称 *
## 项目简介 *
## Agent 设置
## 客户端目标 *
## 核心功能 *
## 非功能需求
## 测试用例
## 部署 *
## 鉴权方案
## 技术约束
## 其他说明
```

注意：当前 `/Users/guodongzhuang/github/piflow/templates/req-template.md` 使用 `## 部署 *`、`cloud_provider` 和 `domain=`；`req-maker/assets/req-template.md` 使用 `## 部署域名` 和 `DOMAIN=`。本 skill 面向 piflow-cli 运行准备，应优先采用 piflow 仓库模板，即 `## 部署 *`。

## 处理流程

1. 接收输入上下文。
   - `api_base_url`
   - `project_id`
   - `run_id`
   - `device_api_key`
   - `workspace_root`
   - `template_path`
   - `output_path`

2. 请求需求导出 API。
   - 调用 `GET /api/v1/projects/:id/req-md-export`。
   - 带 `Authorization: Bearer <device_api_key>`。
   - 记录 HTTP 状态，但不得记录 token。

3. 识别响应类型。
   - `application/json`：按 `ReqMdExportDocument` 解析并进入结构化渲染主路径。
   - `text/markdown`：进入兼容路径，执行 Markdown 结构校验后直接写入。
   - 其他类型：失败。

4. 结构化数据校验。
   - 校验顶层字段存在。
   - 校验枚举字段。
   - 校验 `features[]` 至少保留可渲染标题和描述。
   - 校验追溯字段完整。
   - 校验数组字段统一为数组，字符串字段统一 trim。

5. 加载模板。
   - 首选 `/Users/guodongzhuang/github/piflow/templates/req-template.md`。
   - 若 CLI 环境无法读取该路径，可使用打包随附模板。
   - 只使用模板的章节顺序和字段名，不复制注释到最终输出。

6. 渲染 Markdown。
   - 按模板章节顺序输出。
   - 所有列表使用 `  -` 缩进。
   - 空数组输出 `  -` 占位。
   - 保留中文标题和字段名。
   - 不输出 Backend 内部字段，除明确追溯字段外。

7. 输出前自检。
   - 检查所有必需章节存在且顺序正确。
   - 检查每个 Feature 有 `priority`、`phase`、`client_targets`、`description`、`acceptance_criteria`。
   - 检查每个 Feature 有 `requirement_id`、`item_id`、`version_number`、`version_hash`、`version_status`。
   - 检查 `domain=` 不带 `https://` 和路径。
   - 检查敏感值未写入 req.md，例如 `api_key`、`cursor_api_key`、Bearer token。

8. 写入文件。
   - 写入 `<workspace_root>/<project_id>/inputs/req.md`。
   - 已存在文件直接覆盖。
   - 写入失败时返回可读错误摘要。

## 兼容当前 piflow-online 实现

当前 piflow-online 后端实现的 `GET /projects/:id/req-md-export` 返回 `text/markdown; charset=utf-8`，而不是 `ReqMdExportDocument` JSON。兼容策略：

- 如果响应是 Markdown，`req-review` 不重新解析业务字段生成另一份 Markdown。
- 只执行模板章节校验和敏感信息检查。
- 如果章节缺失或顺序明显不符合模板，返回失败并提示 Backend 导出格式不兼容。
- 如果校验通过，直接写入 `inputs/req.md`。

这条兼容路径是临时兜底；长期推荐 Backend 返回 JSON，由 `req-review` 统一渲染，避免 Backend 与 CLI 各维护一套模板逻辑。

## Skill 输入契约

建议 `req-review` 被调用时接收：

```json
{
  "mode": "export-req-md",
  "api_base_url": "https://piflow.org/api/v1/",
  "project_id": "project_uuid",
  "run_id": "run_uuid",
  "device_api_key": "secret",
  "workspace_root": "/Users/name/piflow-projects",
  "template_path": "/Users/guodongzhuang/github/piflow/templates/req-template.md",
  "output_path": "/Users/name/piflow-projects/project_uuid/inputs/req.md"
}
```

敏感字段要求：

- `device_api_key` 只能用于请求，不得写入输出、日志或错误摘要。
- 错误中出现 token、`api_key`、`cursor_api_key` 时必须脱敏。

## Skill 输出契约

成功：

```json
{
  "status": "succeeded",
  "output_path": "<workspace_root>/<project_id>/inputs/req.md",
  "source_format": "json",
  "template_ref": "templates/req-template.md",
  "feature_count": 8,
  "test_case_count": 6,
  "warnings": []
}
```

兼容 Markdown 成功：

```json
{
  "status": "succeeded",
  "output_path": "<workspace_root>/<project_id>/inputs/req.md",
  "source_format": "markdown",
  "template_ref": "templates/req-template.md",
  "feature_count": null,
  "test_case_count": null,
  "warnings": ["Backend returned rendered Markdown; structured validation was skipped."]
}
```

失败：

```json
{
  "status": "failed",
  "error_code": "REQ_EXPORT_INVALID",
  "error_summary": "req-md-export 响应缺少 project_name.name_zh",
  "safe_for_run_status": true
}
```

错误码建议：

- `REQ_EXPORT_AUTH_FAILED`
- `REQ_EXPORT_FORBIDDEN`
- `REQ_EXPORT_NOT_FOUND`
- `REQ_EXPORT_NETWORK_ERROR`
- `REQ_EXPORT_INVALID`
- `REQ_TEMPLATE_MISSING`
- `REQ_RENDER_FAILED`
- `REQ_WRITE_FAILED`

## 自检规则

### 章节规则

必须包含：

- `# 项目需求说明`
- `## 项目名称 *`
- `## 项目简介 *`
- `## Agent 设置`
- `## 客户端目标 *`
- `## 核心功能 *`
- `## 非功能需求`
- `## 测试用例`
- `## 部署 *`
- `## 鉴权方案`
- `## 技术约束`
- `## 其他说明`

### Feature 规则

每个 `### Feature:` 块必须包含：

- `feature_id:`
- `priority:`
- `phase:`
- `client_targets:`
- `description:`
- `user_stories:`
- `acceptance_criteria:`
- `dependencies:`

每个来自 Backend 需求项的 Feature 还必须包含：

- `requirement_id:`
- `item_id:`
- `version_number:`
- `version_hash:`
- `version_status:`

### 安全规则

禁止输出：

- `device_api_key`
- `cursor_api_key`
- `api_key_hash`
- `Authorization`
- `Bearer <token>`
- Admin session cookie
- 内部 stack trace

## 与 piflow-cli 的集成点

推荐 piflow-cli 在 `start` 指令处理阶段调用：

1. 心跳拿到：

```json
{
  "command_id": "command_uuid",
  "type": "start",
  "run_id": "run_uuid",
  "project_id": "project_uuid"
}
```

2. CLI ack 后调用 `req-review`。

3. `req-review` 成功后，CLI 再写入 `config.env` 的 `CURSOR_API_KEY`。

4. 两者都成功后，CLI 上报：

```json
{
  "status": "running"
}
```

5. 如果 `req-review` 失败，CLI 上报：

```json
{
  "status": "failed",
  "error_summary": "准备失败: req-md-export 响应缺少必需章节"
}
```

## 推荐文档结构

如果未来真正新增 `req-review` skill，建议目录如下：

```text
req-review/
  SKILL.md
  assets/
    req-template.md
  references/
    req-md-export-schema.md
    req-md-rendering-rules.md
```

如果保留在 `req-maker` skill 内扩展，则建议新增独立章节：

- `## Cloud Export Rendering`
- `## ReqMdExportDocument Schema`
- `## Runtime Safety Rules`

但从职责边界看，`req-maker` 负责“从材料生成需求”，`req-review` 负责“审核/导出云端需求并生成运行输入”，建议拆成独立 skill。

## 验收标准

- 给定合法 `ReqMdExportDocument`，输出 Markdown 包含所有 PiFlow 模板顶层章节。
- 输出 Feature 块保留版本追溯字段。
- 输出不包含任何设备密钥或 Bearer token。
- `client_targets`、`priority`、`phase`、`version_status` 非法时失败。
- Backend 返回 Markdown 时，兼容路径能校验并写入。
- Backend 返回错误响应时，skill 输出可直接用于 `POST /runs/:id/status` 的安全错误摘要。

