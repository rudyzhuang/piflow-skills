---
title: prd-reviewer 优化方案
版本: 1.0.0
文档状态: 已执行
代码实现: 已执行
实现文档版本: 0.2.0
创建时间: 2026-06-21 14:55
修改时间: 2026-06-21 00:25
作者: Codex
评审轮次: 1
评审结果: 通过
来源上下文:
  - 用户要求按与 prd-spec-author、prd-client-author 类似的标准评审 prd-reviewer，并更新 piflow 方案文档
  - skills/prd-reviewer/SKILL.md
  - skills/prd-reviewer/README.zh-CN.md
  - /Users/guodongzhuang/github/piflow/docs/stages/prd-review.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-review-default.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-review-website.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-review-admin.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-review-backend.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-review-mobile.md
  - /Users/guodongzhuang/github/piflow/schemas/prd-review-client-output.schema.json
  - /Users/guodongzhuang/github/piflow/schemas/prd-review-output.schema.json
  - /Users/guodongzhuang/github/piflow/skill-libraries/repos/gstack/office-hours/SKILL.md
  - /Users/guodongzhuang/github/piflow/skill-libraries/repos/gstack/office-hours/sections/design-and-handoff.md
---

# prd-reviewer 优化方案

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

`prd-reviewer` 当前承担 PiFlow `prd-review` 阶段的本端评审角色，读取 `prd-spec.md`、单端 `prd-<client_target>.json` 和对应 feature list，输出 canonical `output-stages/prd-review/prd-review-<client_target>.json`。它已经覆盖目标职责清晰度、功能拆解、验收可测性、边界/失败覆盖和实现就绪度，并明确不修改 PRD 正文。

但从“自动门闸能否稳定阻止不成熟 PRD 进入 design/codegen”的角度看，当前 skill 更像一个轻量 readiness reviewer，约束还不够硬。主要缺口包括：

- 评审维度有列举，但缺少证据矩阵，blocking issue 容易变成主观判断；
- `include/defer/block` 的判定边界不够具体，容易把建议误标成阻塞，或把真实阻塞降级成建议；
- 对 shared PRD、端内 PRD、feature list、`stages.prd.outputs.features[]` 四者一致性的主动核对不够强；
- 对 `suggested_prd_spec_changes`、clarification、auto-fix feedback 的分类不够细，影响回流质量；
- 缺少类似 `office-hours` 的 adversarial review loop 思路，评审输出本身没有被反向检查。

### 目标

- 把 `prd-reviewer` 从“单端 readiness 评审器”升级为“证据化 PRD 门闸 reviewer”。
- 强化 blocking / recommendation / clarification / suggested spec change 的分级规则。
- 明确每个 feature assessment 必须引用具体证据来源，避免乐观或空泛通过。
- 借鉴 `office-hours` 的 adversarial review 机制，对评审输出做完整性、一致性、清晰度、范围和可行性自检。
- 保持 `prd-reviewer` 的只读评审边界，不把它变成 PRD author 或正文修复器。

### 非目标

- 本方案不要求 `prd-reviewer` 直接修改 `prd-spec.md` 或各端 `prd-*.json`。
- 本方案不改变 `prd-review` 阶段按端输出和全局合并的脚本架构。
- 本方案不重设 `schemas/prd-review-*.schema.json` 的字段结构，只先强化 skill authoring/review contract。
- 本方案不引入人工审批流；`prd-review` 仍是 AI 自动门闸。

## 2. 当前状态与约束

### 当前状态

- `prd-reviewer` 当前要求：
  - 只写 `output-stages/prd-review/prd-review-<client_target>.json`
  - 不修改 PRD 正文、各端 PRD 或 `stages.json`
  - 每个 reviewed feature 需要一条 `feature_assessments`
  - passed 时不得含 unresolved blocking issue
  - 输出应包含 summary、feature assessments、deferred features、blocking issues、scores、recommendations 和 decision
- `docs/stages/prd-review.md` 进一步规定：
  - 脚本以 `stages.prd.outputs.features[]` 作为 feature 全集真源
  - 单端输出会做 schema、覆盖和越权校验
  - 全局合并会处理 include/defer 冲突和 phase plan
  - failed 时澄清问题可同步回 `inputs/req.yaml`
- 端特定 prompts 只保留少量兼容约束：
  - website 检查 URL / `/website/` 子路径
  - admin 检查角色权限、ProLayout、默认 `/projects`
  - backend 检查 API、错误语义、鉴权、数据模型、deploy/smoke/config
  - mobile 检查弱网、权限拒绝、平台差异和非 MVP 原生能力 defer

### 约束

- `prd-reviewer` 是评审门闸，不是修复器；它必须产出可操作的 review JSON，而不是改写被评审产物。
- 单端 reviewer 只能评审当前端可见 feature，不能自作主张合并全局结论。
- 全局 include/defer 冲突和 phase plan 仍由脚本合并处理。
- Review JSON 需要继续兼容现有 schema、merge logic、clarification sync 和 design stage 门闸。
- 因为下游 `design` 依赖 `phase_plan[]`，reviewer 的 passed 判定要比普通文档评审更保守。

### 假设

- `prd-spec-author` 和 `prd-client-author` 已逐步强化 authoring contract，`prd-reviewer` 可以把重心从“补基础字段”转向“门闸判断”。
- `office-hours` 的流程机制可借鉴，但其 startup/builder 模式、YC closing 和用户关系逻辑不适合引入 PiFlow 流水线。
- 首阶段优先通过 skill 文档增强 reviewer 判断质量，不要求马上改脚本或 schema。

## 3. 方案概述

- 保留 `prd-reviewer` 作为 `prd-review` 阶段唯一官方 reviewer skill，不新增按端独立 reviewer 主 skill。
- 将 review 从“检查字段是否存在”升级为“证据化 readiness gate”：
  - 每个 feature assessment 必须说明证据来源；
  - 每个 blocking issue 必须说明具体阻塞下游哪个环节；
  - 每个 defer 必须说明 defer 原因与进入条件；
  - 每个 clarification 必须区分用户决策问题与可自动修订建议。
- 借鉴 `office-hours` 的两类机制：
  - premise challenge：评审前先检查 PRD 的关键前提是否成立；
  - adversarial review loop：评审 JSON 写出前对自身结论做反向检查。
- 不让 reviewer 直接修正文档，而是通过 `blocking_issues`、`suggested_prd_spec_changes`、`recommendations` 和 clarification feedback 指导上游重跑。
- 对高差异端采用端特定 checklist，而不是拆成多个主 skill：
  - admin: 权限、审计、ProLayout 壳层、默认业务落点
  - backend: API、数据、错误语义、鉴权、资源与部署
  - website: 页面、路由、API 调用、URL 与部署路径
  - mobile: 平台差异、弱网、权限、离线/失败语义

## 4. 详细设计

### 模块与职责

#### 4.1 `prd-reviewer` 的职责升级

升级后的 `prd-reviewer` 仍只产出单端 review JSON，但职责从“就绪度评估”扩大为“证据化 PRD 门闸判断”，具体包括：

- 对每个当前端 feature 做 include / defer / block 判断；
- 判断该 feature 是否足够进入 design，而不是是否已经完美；
- 识别会导致 design/codegen 做错、卡住或扩大 scope 的真实 blocking issue；
- 将非阻塞建议放入 recommendations，不污染 blocking gate；
- 将 shared PRD 层问题放入 `suggested_prd_spec_changes`，不假装端内 reviewer 能直接修复；
- 对 unanswered product decisions 生成具体、可回答的 clarification candidates。

#### 4.2 Evidence Matrix

建议在 skill 中引入 evidence matrix 概念。每个 feature assessment 评审时至少检查以下证据：

- shared PRD evidence:
  - `prd-spec.md` 中是否定义了该 feature 的业务意图、范围和跨端关系
- client PRD evidence:
  - 当前端 `prd-<client_target>.json` 是否有对应 feature
  - 当前端字段是否足够支撑设计/实现
- feature list evidence:
  - `feature_list-<client_target>.md` 是否与 JSON 一致
- readiness evidence:
  - acceptance 是否可测
  - edge/failure 是否足够
  - dependencies 是否清楚
  - auth/deploy/API/route/screen/page 等端特定 contract 是否完整

评审输出可以继续保持现有 schema，但 `notes`、`blocking_issues`、`blocking_gaps`、`recommendations` 中必须写出证据位置或缺失证据。

#### 4.3 Blocking 分级规则

建议明确以下分级：

- blocking issue:
  - 会导致 design/codegen 无法判断做什么
  - 会导致跨端 feature 语义冲突
  - 缺少关键验收标准、错误语义、权限边界、数据/API 合同或部署路径
  - include/defer 决策无法成立
- clarification:
  - 需要用户做产品取舍或范围决策
  - 不能由 reviewer 从已有 PRD 中合理推断
- suggested PRD spec change:
  - shared PRD 本身不完整、矛盾或缺少跨端约束
- recommendation:
  - 不阻塞 design/codegen，但能提升清晰度、体验、可维护性或后续实现质量

核心规则：只有会让下游做错或卡住的问题才能 blocking；风格、措辞、轻微细节不足应进入 recommendation。

#### 4.4 Include / Defer / Block 判定

单端 reviewer 需要对每个 feature 明确判断：

- include:
  - 当前端 PRD 已足够支撑 design；
  - 仍可有非阻塞 recommendation；
  - `phase` 必须明确。
- defer:
  - 当前 feature 有价值，但不应进入当前 design/codegen；
  - 必须说明 defer 原因、解除条件和是否影响其它 feature。
- block:
  - 当前 feature 不应进入 design；
  - 必须产生 blocking issue 或 blocking gap；
  - passed decision 不允许残留 block。

如果现有 schema 仅允许 `include/defer` disposition，block 应表达为 `defer + blocking_issues` 或 `decision=failed`，而不是发明新 disposition。

#### 4.5 借鉴 `office-hours` 的评审机制

`office-hours` 中最值得借鉴的是两个动作：

- premise challenge:
  - 在写最终设计文档前先挑战前提
  - 对 PiFlow 可转为“PRD readiness premise check”
- adversarial review loop:
  - 文档生成后从 completeness、consistency、clarity、scope、feasibility 五个维度反审
  - 对 PiFlow 可转为“review JSON self-check”

建议 `prd-reviewer` 在最终写 JSON 前执行轻量 self-check：

- Completeness:
  - 当前端可见 feature 是否都有 assessment
- Consistency:
  - decision、blocking issues、deferred features、scores 是否互相一致
- Clarity:
  - 每个 issue 是否足够具体，可由 author stage 修复
- Scope:
  - 是否把非阻塞建议误判成 blocking
- Feasibility:
  - passed feature 是否真的足够进入 design/codegen

该 self-check 不需要额外产物，作为 skill 内部 mandatory quality check 即可。

### 数据与接口

#### 4.6 输出结构增强建议

不改变 schema 的前提下，建议规范各字段内容：

- `review.summary`
  - 简述当前端是否可进入 design
  - 点名最高风险区域
- `review.feature_assessments[]`
  - 每个 feature 一条
  - `notes` 中写证据与结论
- `review.deferred_features[]`
  - 只放明确不进入当前阶段的 feature
  - reason 必须可执行
- `review.blocking_issues[]`
  - 每条包含 feature_id 或 top-level field
  - 说明阻塞下游原因
- `review.suggested_prd_spec_changes[]`
  - 仅放 shared spec 层修订建议
  - 不放端内 JSON 小修小补
- `review.blocking_gaps[]`
  - 用于结构化表达缺口类别
- `review.recommendations[]`
  - 非阻塞优化，不影响 passed

#### 4.7 端特定检查表

建议在 skill 本体加入端特定检查表，prompt 只保留补充：

- website:
  - 页面、路由、状态、API 调用、鉴权态、部署 URL
- admin:
  - 角色、权限、审计、敏感操作、ProLayout、默认 `/projects`
- backend:
  - API method/path、错误语义、鉴权、数据表、依赖资源、smoke/deploy
- mobile:
  - screens、API 调用、弱网、离线、权限拒绝、平台差异、非 MVP 原生能力 defer
- default:
  - 至少检查交互面、数据/API 依赖、验收、失败语义和 scope

### 流程与状态

#### 4.8 推荐评审流程

升级后的 `prd-reviewer` 推荐采用以下流程：

1. 读取 `prd-spec.md`、当前端 PRD JSON、feature list 和本端可见 feature references。
2. 建立当前端 feature inventory：
   - expected feature ids
   - PRD JSON feature ids
   - feature list ids
3. 执行 readiness premise check：
   - 当前端职责是否明确
   - 是否存在 shared/client PRD 冲突
   - 是否有无法由 reviewer 推断的产品决策
4. 对每个 feature 执行 evidence matrix 检查。
5. 生成 feature assessments、deferred features、blocking issues、recommendations。
6. 执行 review JSON self-check。
7. 只有当 self-check 通过且无 blocking issue 时设置 `outputs.decision=passed`。

#### 4.9 与 author skill 的边界

- `prd-spec-author` 负责修 shared PRD 总源；
- `prd-client-author` 负责修端内 PRD 合同；
- `prd-reviewer` 负责判断能否进入 design，并输出证据化问题；
- `prd-reviewer` 不直接修正文档，但它的输出必须足够让上游 author 重跑时知道怎么修。

### 第三方机制评估

#### 4.10 `office-hours`

可借鉴：

- hard gate：只产出设计文档，不进入实现；
- premise challenge：先确认关键前提；
- alternatives / recommendation gate：避免第一方案直接落地；
- adversarial review loop：用独立维度反审最终文档。

不适合直接照搬：

- Startup / Builder 双模式不适合自动流水线；
- YC closing、builder profile、resources handoff 与 PiFlow PRD review 无关；
- AskUserQuestion 单步对话不适合全自动 stage 默认路径。

#### 4.11 `gstack` / `superpowers-zh` 其它 skill

可继续借鉴 plan review / spec review 的检查维度，但不建议直接并入默认 `prd-review` stage。`prd-reviewer` 需要理解 PiFlow 的 schema、feature index、phase plan、clarification sync 和下游 design gate，通用 skill 不应取代官方 reviewer。

## 5. 实施计划

### 阶段 1: 强化 `prd-reviewer`

- 修改 `SKILL.md`：
  - 补 evidence matrix；
  - 补 blocking / clarification / recommendation / suggested PRD spec change 分级；
  - 补 include / defer / block 判定规则；
  - 补 review JSON self-check；
  - 补端特定检查表。
- 更新 README，说明其职责升级为证据化 PRD 门闸 reviewer。

验证方式：

- 用 `rg` 检查关键规则是否进入 skill；
- 用已知 PRD 样本验证 passed/failed/defer 输出的语义一致性。

### 阶段 2: 收敛 prompt 与 skill 边界

- 将通用评审规则收敛到 `SKILL.md`；
- 保留端特定 prompt 作为端补充；
- 避免 prompt 与 skill 分裂出两套 blocking 标准。

验证方式：

- 检查 `prd-review-*.md` 仍只保留端兼容约束；
- 确认 skill 是通用 review contract 的主真源。

### 阶段 3: 评估 schema / 脚本增强

- 若 schema 支持，可考虑后续增加更结构化的 evidence 字段；
- 若脚本支持，可考虑把 reviewer self-check metrics 写入 summary；
- 本阶段不是首轮必要项。

验证方式：

- 不破坏现有 `prd-review-client-output.schema.json` 和 `prd-review-output.schema.json`。
- 现有 self-test 继续通过。

## 6. 兼容性与迁移

- 兼容现有 review JSON 路径与 schema。
- 不改变 `outputs.decision` 的含义。
- 不新增必填 JSON 字段，先通过字段内容规范提升质量。
- 若后续新增 evidence 字段，应先做 schema optional 扩展，再让脚本和 summary 逐步消费。
- 默认主链继续使用官方 `prd-reviewer`，不引入第三方 skill 作为 stage 默认 reviewer。

## 7. 测试与验收

### 测试计划

- 基础通过样本：
  - 所有 feature assessment 完整；
  - 无 blocking issues；
  - scores 与 decision 一致。
- 阻塞样本：
  - 缺 acceptance；
  - 缺 API 错误语义；
  - admin 缺权限/ProLayout 约束；
  - mobile 缺弱网/权限失败语义；
  - shared PRD 与端内 PRD 冲突。
- 分类样本：
  - 需要用户决策的问题进入 clarification；
  - shared spec 问题进入 suggested PRD spec changes；
  - 非阻塞优化进入 recommendations。

### 验收标准

- 每个当前端可见 feature 均有 assessment。
- blocking issue 均有证据和下游阻塞说明。
- passed review 不含 unresolved blocking issue。
- defer 均有原因和恢复条件。
- recommendations 不阻塞 design。
- review JSON 自检覆盖 completeness、consistency、clarity、scope、feasibility。

## 8. 风险与回滚

### 风险

- Reviewer 过于严格导致 PRD 阶段频繁阻塞；缓解措施：明确 blocking 只用于会让 design/codegen 做错或卡住的问题。
- Reviewer 规则过重导致输出冗长；缓解措施：要求证据简洁，不要求长篇 Markdown。
- 分类规则不清导致 clarification 噪声增加；缓解措施：明确只有用户必须决策的问题才进入 clarification。
- 与脚本全局 merge 责任重叠；缓解措施：单端 reviewer 只做本端判断，全局冲突仍交给脚本。

### 回滚

- 若强化后误报过多，可回滚 `prd-reviewer/SKILL.md` 和 README，不影响脚本层。
- 若 evidence 规则过重，可先保留 self-check 和 blocking 分级，降低 evidence 细节要求。
- 若端特定检查表与 prompt 冲突，以 skill 通用规则为主，prompt 保留端补充。

## 9. 评审记录

### 第 1 轮评审

- 结论: 通过，方案已执行。
- 发现:
  - 当前 `prd-reviewer` 的职责边界已保留，但 skill 真源已经升级为证据化 PRD 门闸 reviewer。
  - `SKILL.md` 已补入 evidence matrix、blocking/recommendation/clarification 分级、跨产物一致性检查、端特定 checklist 和 review self-check。
  - `office-hours` 的 premise challenge 与 adversarial review loop 已以 reviewer 内部质量检查的形式吸收，没有引入 authoring 或人工辅导职责。
  - 中英文 README、`agents/openai.yaml`、`VERSION` 和 `CHANGELOG.md` 已同步，技能真源与对外说明保持一致。
- 修改:
  - 将代码实现状态更新为已执行，`实现文档版本` 更新为 `0.2.0`。
- 验证:
  - `rg -n "Evidence Matrix|Classification Rules|Consistency Rules|Self-Check Loop|Target-Specific Checklist" skills/prd-reviewer/SKILL.md`
  - `rg -n "evidence-backed blockers|review self-check|带证据的 canonical" skills/prd-reviewer/README.md skills/prd-reviewer/README.zh-CN.md`
  - `git diff --check`
