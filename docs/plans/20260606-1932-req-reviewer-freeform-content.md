---
title: req-reviewer 评审阶段 freeform_content 补全与来源标记方案
版本: 1.0.0
文档状态: 已执行
代码实现: 已执行
实现文档版本: 1.0.0
创建时间: 2026-06-06 19:32
修改时间: 2026-06-06 20:11
作者: Codex
评审轮次: 1
评审结果: 通过
来源上下文:
  - 用户要求项目侧 req.md 在评审时补足 feature 级 freeform_content，并按 AI 补充或用户录入标记 freeform_source。
  - skills/req-reviewer/SKILL.md
  - skills/req-maker/SKILL.md
  - skills/req-maker/assets/req-template.md
  - skills/req-maker/scripts/export-req-md.mjs
  - piflow/scripts/libs/setup-inputs.cjs
  - piflow/scripts/libs/req-sync-agent.cjs
  - piflow/prompts/req-sync.md
---

# req-reviewer 评审阶段 freeform_content 补全与来源标记方案

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

`req-maker` 的模板已经在 Feature 和 Test Case 块中声明 `freeform_content` 与 `freeform_source`，用于承载自由描述和来源追踪。但当前 `req-reviewer` 的评审规则只要求检查 `freeform_source`，没有明确在评审阶段补齐缺失或为空的 `freeform_content`。

用户提出新的评审契约：

- 项目侧 `req.md` 在评审时，如果 feature 没有 `freeform_content` 字段，或字段值为空，需要推理补足。
- 补足的 feature 级 `freeform_content` 应为该 feature 对应功能的自然语言描述。
- AI 推理补足时，`freeform_source` 标记为 AI 补充，即 `from_ai`。
- 在 feature 描述的头部，也要增加一个 `freeform_content` 字段，用于汇总各 feature 的功能描述，表达项目整体功能描述。
- 如果整体功能描述来自用户原始输入，尤其是通过 `req-maker` skill 生成 `req.md` 的场景，项目头部 `freeform_content` 应承载用户提供描述经 AI 梳理后的结果，并标记 `freeform_source: from_user`。

### 目标

- 明确 `req-reviewer` 在评审阶段对项目级和 feature 级 `freeform_content` 的补全规则。
- 明确 `freeform_source` 的来源枚举和兼容映射。
- 保证 `req-maker` 生成的用户原始描述可以在评审后被保留、梳理并追踪为用户录入来源。
- 保证没有用户原始自由描述时，评审 Agent 可以根据结构化 feature 信息推理补足自然语言描述，并标记为 AI 补充。
- 为后续 `req.md` AI 评审、用户确认、需求追溯和 report 生成提供稳定的人可读输入；`req.md -> req.yaml` 同步阶段只吸收其语义，不复制 `freeform_*` 字段。

### 非目标

- 不在本方案中实现代码修改。
- 不改变 feature 的 `description`、`user_stories`、`acceptance_criteria` 主语义。
- 不把 `freeform_content` 作为替代结构化字段的唯一真源；它是 `req.md` 中给用户阅读、确认和评审使用的自由描述。
- 不把 `freeform_content/freeform_source` 写入 `req.yaml`；`req.yaml` 只保留流水线消费的结构化字段。

## 2. 当前状态与约束

### 当前状态

- `skills/req-reviewer/SKILL.md` 已要求检查 `feature_id`、`priority`、`phase`、`client_targets`、`structured_source`、`freeform_source`、`description` 等字段，但没有把 `freeform_content` 列为必须检查和补齐字段。
- `skills/req-maker/assets/req-template.md` 已在 feature 模板中放置 `freeform_content:`，并说明 AI 评审后可自动补齐。
- `skills/req-maker/SKILL.md` 的 draft 模式要求每个 feature/test case 都包含 `freeform_content:`，无补充描述时留空。
- `skills/req-maker/scripts/export-req-md.mjs` 的 Backend export 模式要求结构化 JSON 中存在 `freeform_content` 和 `freeform_source`，但渲染 Markdown 时当前规则倾向于不把它作为独立输出字段。

### 约束

- `req.md` 是面向人可读和流水线可同步的文本，新增字段必须保持模板清晰；其中 `freeform_content/freeform_source` 属于用户可读和评审专用字段。
- `req.yaml` 是流水线结构化真源，不承载 `freeform_content/freeform_source` 等面向用户阅读的自由描述字段。
- 评审阶段可修改 `req.md`，但应保留用户原意，不扩大业务范围。
- 来源标记要能兼容既有 `user | ai`，同时满足用户要求的 `from_user | from_ai` 表达。
- 项目级整体描述和 feature 级描述要分层，避免把全局说明重复塞进每个 feature。
- Backend export 模式有追溯字段和来源字段要求，不能破坏已存在的 `requirement_id/item_id/source_item_id/version_*`。

### 假设

- “feature 描述的头部”指 `## 核心功能 *` 章节开始处、首个 `### Feature:` 之前的项目级自由描述字段。
- 项目级 `freeform_content` 表达项目整体功能描述；feature 级 `freeform_content` 表达单个 feature 的自然语言描述。
- 新来源枚举以 `from_user/from_ai` 为目标语义；短期可兼容 `user/ai`，避免旧模板和脚本立即失效。

## 3. 方案概述

- 在 `req-reviewer` 中新增 freeform 补全规则，作为评审必检项。
- 在 `## 核心功能 *` 章节头部引入项目级字段：
  - `freeform_source: from_user | from_ai`
  - `freeform_content:`
- 每个 `### Feature:` 块必须存在：
  - `freeform_source: from_user | from_ai`
  - `freeform_content: <该 feature 的自然语言功能描述>`
- 对缺失或空值的 feature 级 `freeform_content`，由评审 Agent 根据 `name/description/user_stories/acceptance_criteria/client_targets` 推理补足，并标记 `freeform_source: from_ai`。
- 对通过 `req-maker` 从用户原始描述生成的 `req.md`，项目级 `freeform_content` 使用用户输入经 AI 梳理后的整体功能描述，并标记 `freeform_source: from_user`。
- 对没有明确用户整体描述的历史 `req.md`，项目级 `freeform_content` 由各 feature 描述汇总生成，并标记 `freeform_source: from_ai`。
- `req.md -> req.yaml` 同步时，`freeform_content/freeform_source` 不作为字段写入 `req.yaml`；同步器最多使用其语义改进 `description`、`features[]`、`test_cases[]` 等结构化字段。

## 4. 详细设计

### 模块与职责

#### `skills/req-reviewer/SKILL.md`

新增评审规则：

- 模板检查必须包含 `freeform_content`。
- Feature 级检查必须确认：
  - 字段存在。
  - 字段非空。
  - 内容是自然语言功能描述，不是结构化 YAML 字段拼接。
  - `freeform_source` 与内容来源一致。
- 项目级检查必须确认 `## 核心功能 *` 章节头部存在整体 `freeform_content`。
- 评审修订时直接补齐缺失字段，并追加评审记录说明补齐来源。

#### `skills/req-maker/SKILL.md`

补充 draft 模式输出契约：

- 生成 `req.md` 时，在 `## 核心功能 *` 和首个 feature 之间写入项目级 `freeform_source` 与 `freeform_content`。
- 当输入来自用户自然语言、Figma Make、截图、文档或 prompt 时，项目级 `freeform_content` 视为用户来源经 AI 梳理，标记 `from_user`。
- 每个 feature 级 `freeform_content` 优先使用用户对该功能的原始描述；没有对应原文时留空或由 req-reviewer 后续补齐。

#### `skills/req-maker/assets/req-template.md`

更新模板字段说明：

- 在 `## 核心功能 *` 说明中加入项目级 `freeform_content` 示例。
- 将来源说明从 `user=用户填写，ai=AI 生成或补齐` 扩展为兼容写法：
  - `from_user` 表示用户录入或用户来源经 AI 梳理。
  - `from_ai` 表示 AI 根据结构化需求推理补齐。
  - 兼容旧值 `user` 和 `ai`，但新文档优先输出 `from_user/from_ai`。

#### `skills/req-maker/scripts/export-req-md.mjs`

如需同步 export 模式，调整渲染规则：

- structured JSON 中已有 `freeform_content/freeform_source` 时，渲染到 feature 块中。
- 如果 Backend export 提供项目级 freeform 描述，则渲染到 `## 核心功能 *` 头部。
- 若 Backend 仍只支持 `user | ai`，渲染时转换为 `from_user/from_ai`，内部校验继续兼容旧枚举。

#### `piflow` req.md -> req.yaml 同步链路

新增同步边界：

- `scripts/libs/setup-inputs.cjs`、`scripts/libs/req-sync-agent.cjs` 在写入 `req.yaml` 前递归剥离 `freeform_content/freeform_source` 以及项目级同义字段。
- `prompts/req-sync.md` 明确要求 Agent 不得把 `freeform_content/freeform_source` 原样写入 `req.yaml` 的任何层级。
- 同步阶段可以读取 `freeform_content` 的语义来更新 `description` 等结构化字段，但字段本身只保留在 `req.md`。

### 数据与接口

#### 项目级核心功能自由描述

建议格式：

```markdown
## 核心功能 *

freeform_source: from_user
freeform_content:
用户希望构建一个面向 piflow 流水线使用者和管理员的云端管理平台，覆盖项目、设备、需求、运行状态和报告查看的端到端闭环。

### Feature: admin 端 - 项目列表与项目基础管理
```

#### Feature 级自由描述

建议格式：

```markdown
### Feature: admin 端 - 项目列表与项目基础管理

feature_id: PROJ-MGMT-001
priority: must
phase: mvp
client_targets: [admin, backend]
structured_source: user
freeform_source: from_ai
description:
管理员可以创建、查看、编辑、软删除和恢复项目，并在项目列表中查看项目状态、需求摘要和运行状态。

freeform_content:
这个功能让管理员在后台集中管理 piflow 业务项目，从创建项目开始维护项目基础信息，并通过列表掌握每个项目的当前状态和后续操作入口。
```

### 来源判定规则

- `from_user`：
  - 用户原始 prompt、文档、Figma Make、截图说明或 Backend export 中存在对应自由描述。
  - `req-maker` 已经根据用户来源生成项目整体描述，虽然经过 AI 梳理，但事实来源仍是用户录入。
- `from_ai`：
  - 原始 `req.md` 中没有 `freeform_content` 字段。
  - 字段存在但为空。
  - 字段内容由评审 Agent 根据结构化字段、验收标准或其他 feature 汇总推理生成。

### 流程与状态

1. `req-reviewer` 定位 `inputs/req.md`。
2. 检查 `## 核心功能 *` 头部项目级 `freeform_content`。
3. 遍历所有 `### Feature:` 块。
4. 对缺失或空白 feature 级 `freeform_content` 生成自然语言描述。
5. 根据来源写入或修正 `freeform_source`。
6. 若项目级 `freeform_content` 缺失：
   - 有用户整体描述证据时，梳理后写入 `from_user`。
   - 无用户整体描述证据时，汇总各 feature 的功能描述写入 `from_ai`。
7. 复查字段顺序、来源标记和评审记录。
8. 最终标记 `req.md` 为已评审。

### 安全与权限

- `freeform_content` 不得包含真实密钥、token、cookie、设备 api_key、`cursor_api_key` 或生产密码。
- 从用户来源梳理整体描述时，应过滤私密链接和认证信息，只保留业务意图。

## 5. 实施计划

### 阶段 1: 更新 req-reviewer 规则

- 修改 `skills/req-reviewer/SKILL.md`：
  - 将 `freeform_content` 加入模板和 feature 必检字段。
  - 增加项目级和 feature 级补全规则。
  - 增加 `from_user/from_ai` 来源判定。
  - 增加不得把结构化字段拼接为 `freeform_content` 的质量规则。

### 阶段 2: 同步 req-maker 输出契约

- 修改 `skills/req-maker/SKILL.md`：
  - draft 模式生成项目级 `freeform_content/freeform_source`。
  - 说明用户来源经 AI 梳理仍标记 `from_user`。
- 修改 `skills/req-maker/assets/req-template.md`：
  - 增加项目级示例。
  - 更新来源枚举说明。

### 阶段 3: 同步 export 脚本和兼容枚举

- 修改 `skills/req-maker/scripts/export-req-md.mjs`：
  - 允许 `freeform_source` 为 `user/ai/from_user/from_ai`。
  - 渲染时优先输出 `from_user/from_ai`。
  - feature 块中保留 `freeform_content`。
- 如果 Backend 暂未提供项目级 freeform 描述，脚本不强造 `from_user`，交给 `req-reviewer` 后续按 `from_ai` 汇总补齐。

### 阶段 4: 增加测试和样例

- 增加或更新 req-maker export fixture：
  - feature 缺失 `freeform_content` 时失败或 warning。
  - feature 有 `freeform_content/freeform_source` 时渲染到 Markdown。
  - `user/ai` 兼容输入输出为 `from_user/from_ai`。
- 增加 req-reviewer 文档样例：
  - 缺失 feature freeform 的修订前后对比。
  - 用户整体描述来源和 AI 汇总来源的区别。

### 阶段 5: 增加 req.yaml 清洗守卫

- 修改 `piflow/scripts/libs/setup-inputs.cjs`：
  - 增加 `req.md` 专用字段清洗函数。
  - legacy `req.md` 迁移和确定性 drift merge 写入 `req.yaml` 前剥离 `freeform_content/freeform_source`。
- 修改 `piflow/scripts/libs/req-sync-agent.cjs`：
  - Agent 合并后、写回 `req.yaml` 前复用清洗函数。
- 修改 `piflow/prompts/req-sync.md`：
  - 明确 `freeform_content/freeform_source` 只属于 `req.md`，不得写入 `req.yaml`。
- 修改 `piflow/scripts/self-test/self-test-req-sync.cjs`：
  - 增加回归断言，防止 `freeform_*` 字段进入 `req.yaml`。

### 依赖与排期

- 阶段 1 是核心，优先实施。
- 阶段 2 保证新生成 `req.md` 和评审规则一致。
- 阶段 3 影响 Backend export 兼容，可在 Backend 字段稳定后实施。
- 阶段 4 与前三阶段同步补齐，作为验收依据。

## 6. 兼容性与迁移

- 旧文档中的 `freeform_source: user` 等价于 `from_user`，`freeform_source: ai` 等价于 `from_ai`。
- 已存在但为空的 `freeform_content` 会在评审时被补齐。
- 已存在且非空的 `freeform_content` 默认保留；仅在明显与 feature 不一致、包含模板占位或泄露敏感信息时修正。
- 对历史没有项目级 `freeform_content` 的文档，评审时新增项目级字段，不影响原 feature ID、依赖和测试用例。
- Backend export 若仍不渲染 `freeform_content`，会与 req-reviewer 新规则不一致；因此建议同步修改 export 脚本。
- `freeform_content/freeform_source` 不迁移进 `req.yaml`。历史 `req.yaml` 若已出现这些字段，应在下一次 setup/req-sync 写回时被清洗；必要时可单独运行清洗脚本或重新触发 req-sync。

## 7. 测试与验收

### 测试计划

- 文档规则检查：
  - `req-reviewer` 明确检查项目级和 feature 级 `freeform_content`。
  - `req-reviewer` 明确 `from_user/from_ai` 判定。
- 渲染测试：
  - `export-req-md.mjs` 可接受 `user/ai/from_user/from_ai`。
  - 渲染后的 feature 块包含 `freeform_content`。
- 回归样例：
  - 一个由 `req-maker` 从用户 prompt 生成的 `req.md`，项目级 `freeform_source` 为 `from_user`。
  - 一个旧 `req.md`，没有 feature `freeform_content`，经 `req-reviewer` 后每个 feature 均补齐且标记 `from_ai`。

### 验收标准

- 每个 Feature 块都有非空 `freeform_content`。
- 每个 Feature 块的 `freeform_source` 与来源一致。
- `## 核心功能 *` 头部存在项目级 `freeform_content`。
- 用户来源生成的整体功能描述标记 `from_user`。
- AI 汇总或 AI 推理补齐的描述标记 `from_ai`。
- 旧值 `user/ai` 不导致校验失败，并可被规范化为 `from_user/from_ai`。
- `freeform_content` 不包含密钥、token 或模板占位。
- `req.yaml` 的任意层级都不包含 `freeform_content/freeform_source`。

## 8. 风险与回滚

### 风险

- 来源枚举扩展造成旧脚本校验失败：通过兼容 `user/ai/from_user/from_ai` 缓解。
- 项目级 `freeform_content` 与 `## 项目简介 *` 重复：项目简介保留产品摘要，核心功能头部 freeform 聚焦“功能集合整体描述”。
- AI 补齐内容过度发挥：要求从现有 feature 结构字段推理，不新增业务范围。
- export 模式与 draft 模式规则不一致：同步更新 req-maker 文档和 export 脚本。
- 如果只靠 Agent prompt 约束，仍可能因模型输出漂移把 `freeform_*` 写入 `req.yaml`；因此必须有确定性清洗守卫。

### 回滚

- 如新字段渲染影响下游，可先保留 `req-reviewer` 检查与补齐规则，将 export 脚本渲染改回兼容模式。
- 若 `from_user/from_ai` 影响旧校验，可暂时输出 `user/ai`，但在评审记录中保留来源语义。
- 如清洗守卫影响下游，可临时只保留 prompt 约束；但这会降低防污染能力，需同步增加 `req.yaml` 校验告警。

## 9. 评审记录

### 第 1 轮评审

- 结论: 通过
- 发现:
  - 方案明确区分项目级整体 freeform 和 feature 级 freeform，避免字段语义混杂。
  - 方案兼容既有 `user/ai`，同时满足用户要求的 `from_user/from_ai` 来源表达。
  - 方案覆盖 `req-reviewer`、`req-maker` 模板和 export 脚本，能避免生成和评审规则不一致。
- 修改:
  - 无需修改。

### 第 2 轮执行复核

- 结论: 通过，方案已执行。
- 发现:
  - `req-reviewer` 已补充项目级和 feature 级 `freeform_content` 必检、补齐与来源判定规则。
  - `req-maker` draft/export 契约已同步为显式渲染 feature `freeform_content`，并兼容 `user/ai/from_user/from_ai`。
  - export 脚本已渲染项目级、feature 级和 test case 级 freeform 字段，并新增自测覆盖来源规范化。
- 修改:
  - 将代码实现状态更新为已执行。
- 验证:
  - `node --check skills/req-maker/scripts/export-req-md.mjs`
  - `node --check skills/req-maker/scripts/self-test-export-freeform.mjs`
  - `node skills/req-maker/scripts/self-test-export-freeform.mjs`
  - `git diff --check`

### 第 3 轮补充评审

- 结论: 通过，req.yaml 清洗守卫已执行并验证通过。
- 发现:
  - `freeform_content/freeform_source` 是给用户阅读、确认和评审使用的 `req.md` 字段，不应进入流水线结构化真源 `req.yaml`。
  - 仅在 `req-reviewer/req-maker` 中规定字段不足以阻止污染，因为 `req-sync` Agent 和确定性合并都有机会把 Markdown 字段复制到 YAML。
  - 需要同时增加 prompt 约束和代码级清洗守卫，避免模型输出漂移导致 `req.yaml` 出现 `freeform_*` 字段。
- 修改:
  - 方案新增 `req.yaml` 清洗边界、阶段 5、验收标准和风险说明。
  - `piflow` 同步链路已增加清洗守卫和回归测试。
- 验证:
  - `node --check scripts/libs/setup-inputs.cjs`
  - `node --check scripts/libs/req-sync-agent.cjs`
  - `node --check scripts/self-test/self-test-req-sync.cjs`
  - `node scripts/self-test/self-test-req-sync.cjs`
  - `node skills/req-maker/scripts/self-test-export-freeform.mjs`
  - `git diff --check`
