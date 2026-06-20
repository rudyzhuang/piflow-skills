---
title: prd-spec-author 优化方案
版本: 1.0.0
文档状态: 已执行
代码实现: 已执行
实现文档版本: 0.2.0
创建时间: 2026-06-21 14:10
修改时间: 2026-06-21 00:25
作者: Codex
评审轮次: 1
评审结果: 通过
来源上下文:
  - 用户要求评审 prd-spec-author 在 PiFlow 流水线中的职责，并在 skill 目录生成可落地方案
  - SKILL.md
  - ../req-maker/SKILL.md
  - ../req-reviewer/SKILL.md
  - /Users/guodongzhuang/github/piflow/templates/skills-template.yaml
  - /Users/guodongzhuang/github/piflow/docs/stages/prd.md
  - /Users/guodongzhuang/github/piflow/skill-libraries/libs/superpowers-zh/writing-plans/skill.yaml
  - /Users/guodongzhuang/github/piflow/skill-libraries/libs/gstack/spec/skill.yaml
---

# prd-spec-author 优化方案

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

`prd-spec-author` 当前承担 PiFlow `prd` 阶段 Agent-A 角色，负责把 `output-stages/setup/canonical-req.json` 或 `inputs/req.yaml` 转成共享 PRD 总源 `output-stages/prd/prd-spec.md`。现有 skill 已经明确了编辑边界、保留非空内容、`feature_id` 命名和部署架构不越权等基本规则，但更偏“增量补全器”，对“从原始需求稳定完善为完整产品规格”的约束还不够强。

对比同仓库中的 `req-maker` 与 `req-reviewer` 可以看到，需求阶段已经有较完整的来源覆盖、质量复审、兼容性检查和多轮修订闭环；而 PRD 总源阶段仍缺少等价的闭环，因此在以下场景容易产生质量波动：

- setup 输出已更新，但旧 `prd-spec.md` 的非空内容阻止了必要修正；
- requirement 中的细粒度约束、异常分支或跨端契约没有完整进入 PRD；
- 下游 `prd-client-author` 能生成结构化 JSON，但共享总源信息密度不足；
- 后续做 review、变更影响分析或 recovery 时，很难从 PRD feature 回溯上游需求项来源。

### 目标

- 把 `prd-spec-author` 从“增量补全器”升级为“共享 PRD 总源作者器”，提升从原始需求到完整 PRD 的稳定性。
- 在不破坏现有 `prd` 阶段主链的前提下，引入来源覆盖、质量复审和冲突纠正机制。
- 明确 `prd-spec.md` 的最低产品规格契约，使其足够支撑 `prd-client-author`、`prd-reviewer`、`design` 和 `codegen`。
- 为后续新增 `prd-spec-reviewer` 留出清晰接入点。
- 评估 `gstack` 和 `superpowers-zh` 相关 skill 的可借鉴点，并给出是否应并入流水线的结论。

### 非目标

- 本方案不直接修改 `scripts/stages/prd.cjs` 的编排入口。
- 本方案不替换现有 `req-maker -> req-reviewer -> prd-spec-author -> prd-client-author -> prd-reviewer` 主链。
- 本方案不要求把第三方 skill 直接设置为 `prd` 阶段默认启用。
- 本方案不在本轮定义各端 `prd-*.json` schema 变更细节。

## 2. 当前状态与约束

### 当前状态

- `templates/skills-template.yaml` 当前在 `prd` 阶段只启用了 `prd-spec-author` 和 `prd-client-author`。
- `prd-spec-author` 当前规则强调：
  - 只更新 `output-stages/prd/prd-spec.md`；
  - 保留已有非空内容；
  - 只补占位、缺失行或明显不完整内容；
  - 维持 `产品意图 / 客户端目标 / 核心功能 / 范围与非目标 / 完整性覆盖 / 部署架构` 六个核心段落；
  - `核心功能` 中必须有全局唯一 `feature_id`。
- `req-maker` 已具备：
  - 从自然语言或结构化来源整理需求；
  - 先抽整体叙述，再拆 feature；
  - 运行 source coverage review loop；
  - 运行 requirement quality review loop。
- `req-reviewer` 已具备：
  - 模板格式检查；
  - 多客户端契约与兼容性检查；
  - 多轮修订直到通过；
  - 状态标注与评审记录。

### 约束

- `prd-spec-author` 必须继续只写 `output-stages/prd/prd-spec.md`，不能越权修改各端 `prd-*.json` 或 `stages.json`。
- `prd` 阶段仍需保持“共享 PRD 总源 + 分端 PRD JSON”的两层结构，避免把所有细节都挤进单一文件。
- 现有“保留非空内容”的设计有价值，因为它降低了 Agent 误删已有 PRD 内容的风险；优化时应改为“保留有效内容”而非简单放弃保留策略。
- 部署 URL、最终 config 同步、gateway scaffold 仍应由脚本层处理，不能把 deterministic sync 职责重新塞回 skill。
- 第三方 skill 当前在 skill 库中都是 `catalog-only` 或 `explicit-on-demand` 倾向，不能未经验证直接设为默认 stage skill。

### 假设

- setup 阶段输出的 `canonical-req.json` 将持续作为上游业务真源。
- 未来若新增 `prd-spec-reviewer`，其接入点优先放在 Agent-A 之后、Agent-B 之前。
- `prd-spec.md` 允许在保持现有主标题结构的前提下增加更细粒度子章节或表格列。

## 3. 方案概述

- 保留官方 skill 主链，优先强化 `prd-spec-author` 本身，而不是直接用第三方 skill 替代。
- 把 `req-maker` / `req-reviewer` 中已经验证有效的三类机制移植到 `prd-spec-author`：
  - 来源覆盖检查；
  - 质量与一致性复审；
  - 冲突时以上游真源为准的修订闭环。
- 重新定义 `prd-spec-author` 的保留规则：从“只补空白”升级为“保留非冲突有效内容，发现与 requirement 冲突时必须纠正”。
- 扩充 `prd-spec.md` 的最低契约，使其不仅有 feature 表，还能表达用户流程、角色权限、跨端契约、异常处理和验收口径。
- 不建议把 `gstack/spec`、`gstack/document-generate` 或 `superpowers-zh/writing-plans` 直接并为 `prd` 阶段默认 skill；它们更适合作为方法参考或人工前置工具。
- 第二阶段再新增官方 `prd-spec-reviewer`，把 shared spec review 从 per-client review 中独立出来。

## 4. 详细设计

### 模块与职责

#### 4.1 `prd-spec-author` 的职责升级

升级后的 `prd-spec-author` 仍是 `prd` 阶段 Agent-A，但职责从“增量补全文档”扩大为“基于 requirement 真源生成并维护共享 PRD 总规格”，具体包括：

- 读取并吸收 requirement 真源中的产品目标、用户角色、客户端范围、核心功能、边界、依赖和部署语义；
- 在保留已有有效 PRD 内容的前提下，修正与真源冲突的旧内容；
- 为下游各端 PRD 生成提供稳定的 shared semantic source；
- 在结束前主动执行 coverage / quality 双轮自检，而不是只做轻量标题检查。

#### 4.2 新增建议职责：`prd-spec-reviewer`

建议新增一个官方 reviewer skill，定位为：

- 输入：`canonical-req.json`、`inputs/req.yaml`、`output-stages/prd/prd-spec.md`
- 输出：可先不要求独立产物，允许在第一阶段以“就地修订 + 最终通过”方式运行
- 目标：对 shared PRD spec 做总源级审查，发现 blocking gap 后修订，再允许 Agent-B 继续

该 skill 不一定要在本轮落地，但本方案会为其预留 wiring 和检查面。

### 数据与接口

#### 4.3 `prd-spec.md` 的最低契约升级

在保留现有六个必需标题的前提下，建议把输出契约升级为以下内容至少可被清晰表达：

- `## 产品意图`
  - 目标用户
  - 业务价值
  - MVP 成功标准
- `## 客户端目标`
  - 各逻辑端职责边界
  - 是否参与首发
- `## 核心功能`
  - feature 表至少包含：`feature_id`、`feature_name`、`client_targets`、`priority`、`phase`、`summary`
  - 建议新增：`source_requirement_ids` 或 `source_item_ids`
- `## 范围与非目标`
  - in-scope
  - out-of-scope
  - explicit non-goals
- `## 完整性覆盖`
  - happy paths
  - edge cases
  - failure cases
  - 关键验收口径
- `## 部署架构`
  - 平台与环境原则
  - 路由与端职责原则
  - 不手写最终脚本应同步的 URL 矩阵

此外，建议允许新增以下 H2 或 H3 级补充结构：

- `## 角色与权限`
- `## 核心用户流程`
- `## 跨端协作与接口契约`
- `## 状态与异常处理`
- `## 依赖与前置条件`

#### 4.4 Traceability 设计

PRD 总源不需要把 `req.md` 的所有 traceability 字段原样搬过来，但建议至少保留轻量级映射：

- 若 requirement 真源能提供稳定需求项 ID，则在 feature 表中加入 `source_requirement_ids`
- 若来源只是 `req.yaml` 或弱结构化 requirement，则允许使用简化映射值，如 requirement section path

目标不是把 `prd-spec.md` 变成数据库导出，而是让后续 review / recovery / impact analysis 能定位“这个 feature 来自哪些需求项”。

### 流程与状态

#### 4.5 推荐生成流程

升级后的 `prd-spec-author` 推荐采用以下流程：

1. 读取 requirement 真源与现有 `prd-spec.md`。
2. 先做 requirement summary extraction：
   - 识别产品目标、客户端、功能域、边界、依赖、关键流程、风险和部署原则。
3. 运行 shared PRD drafting：
   - 生成或修订 `prd-spec.md`；
   - 保留非冲突有效内容；
   - requirement 与旧 PRD 冲突时，以 requirement 真源为准修正。
4. 运行 source coverage review loop：
   - 检查 requirement 中每类事实是否已进入 PRD；
   - 检查是否遗漏跨端依赖、边界条件、异常分支和部署约束。
5. 运行 spec quality review loop：
   - 检查 feature_id、客户端职责、scope、non-goals、edge/failure 覆盖、逻辑一致性和下游可消费性。
6. 两轮 review 均通过后结束。

#### 4.6 保留策略重定义

现有“保留已有非空内容”的规则保留，但改为以下三分法：

- 保留：
  - 与 requirement 真源一致的已有内容；
  - 比 requirement 表达更完整、但不冲突的补充说明；
  - 已存在且仍然有效的 `feature_id`。
- 修正：
  - 与 requirement 冲突的旧目标、旧范围、旧客户端或旧功能含义；
  - 与新需求不再一致的部署表述；
  - 已存在但语义漂移的 feature 行。
- 删除或替换：
  - 明显过期的 placeholder；
  - 空壳段落；
  - 与当前 requirement 无法同时成立的历史描述。

### 安全与权限

- `prd-spec-author` 继续禁止写入 secret、token、password、device key、cookie 或真实凭证。
- 若 requirement 来源包含敏感部署信息，只在产品层表达“有鉴权 / 有私网 / 有环境隔离”等原则，不下沉到 secrets。
- 第三方 skill 若仅能作为人工辅助使用，也不得在自动 stage 中要求额外联网、外部 issue 写入或交互式问答。

### 第三方 skill 评估

#### 4.7 `superpowers-zh/writing-plans`

可借鉴点：

- 先做覆盖拆解，再写执行内容；
- 强调验收与自检；
- 避免空泛占位语句。

不建议直接启用的原因：

- 它面向实现计划，不是产品规格生成；
- 推荐 wiring 是 `enabled_stage_unit`，偏 codegen 规划；
- 会引入计划文档产出路径和实施语义，不适合 `prd` 自动主链。

#### 4.8 `gstack/spec`

可借鉴点：

- 擅长把模糊意图转成清晰 spec；
- 适合作为人工前置梳理。

不建议直接启用的原因：

- 它是 `read-only` 且 `explicit-on-demand`；
- 设计目标偏 issue / backlog / spec filing，不是写 PiFlow `prd-spec.md`；
- 不理解 PiFlow 的 `feature_id`、client target、部署同步和下游 stage contract。

#### 4.9 结论

推荐策略是：

- 官方主链继续使用官方 skill；
- 借鉴第三方 skill 的方法，但不要直接在 `prd` stage 默认并用；
- 若要试点第三方 skill，只适合在人工模式或非默认实验 profile 中按需开启。

## 5. 实施计划

### 阶段 1: 强化 `prd-spec-author`

- 修改 `SKILL.md`，加入以下硬规则：
  - source coverage review loop；
  - spec quality review loop；
  - 冲突修正规则；
  - 最低 PRD 契约扩展；
  - 轻量 traceability 规则。
- 保持输出文件边界不变，避免一次性引入脚本改造。
- 更新中英文 README，说明职责升级与新增检查项。

验证方式：

- 让同一份 canonical requirement 分别驱动“首次生成”和“增量修订”两种场景；
- 验证旧非空内容不会被无故清空；
- 验证冲突内容会被 requirement 真源纠正；
- 验证 `prd-spec.md` 至少覆盖六大核心段落和扩展检查面。

### 阶段 2: 新增 `prd-spec-reviewer`

- 新建官方 skill，职责是审查 shared PRD spec 并直接修订。
- 首版可不写独立 review artifact，只要求最终共享 PRD 通过。
- 在 skill 模板中为 `prd` 阶段增加一个 append unit 或显式 reviewer 位置。

验证方式：

- 构造遗漏 edge case、缺少跨端契约、feature_id 冲突的 PRD 样本；
- 验证 reviewer 能发现并修订；
- 验证未通过前不应继续下游 per-client PRD 生成。

### 阶段 3: 视需要补充脚本与自测

- 若后续需要更强收敛，可在 `scripts/stages/prd.cjs` 中增加 Agent-A 后 reviewer 调用点。
- 增加与 `prd-spec-author` 相关的 self-test 或 fixture 覆盖：
  - 增量保留；
  - conflict correction；
  - feature traceability；
  - scope / non-goal completeness。

验证方式：

- 运行新增 self-test；
- 验证 `prd` stage 在 requirement 变更后不会跳过必要修正。

### 依赖与排期

- 推荐顺序：先改 `prd-spec-author`，再补 `prd-spec-reviewer`，最后再评估是否需要 stage 脚本改造。
- 第一阶段可以独立落地，收益最高，风险最低。
- 第二阶段开始才需要评估 runtime wiring 变化。

## 6. 兼容性与迁移

- 兼容现有 stage 主链：
  - `req-maker`
  - `req-reviewer`
  - `prd-spec-author`
  - `prd-client-author`
  - `prd-reviewer`
- 不破坏现有 `prd-spec.md` 产物路径。
- 对已有项目的兼容策略：
  - 已存在的有效 feature_id 保持不变；
  - 已存在且不冲突的段落尽量保留；
  - 与上游 requirement 明确冲突的内容在重跑 `prd` 时修正。
- 若新增 `source_requirement_ids` 等列：
  - 优先作为向后兼容的可增量字段；
  - 下游若暂不消费，不应阻断 PRD 生成。

## 7. 测试与验收

### 测试计划

- 单技能生成测试：
  - 从空 `prd-spec.md` 生成；
  - 从已有非空 `prd-spec.md` 增量修订；
  - requirement 更新后修正冲突内容。
- 质量检查测试：
  - 漏掉客户端目标；
  - 漏掉 non-goals；
  - 漏掉 edge/failure cases；
  - feature_id 重复或语义不一致；
  - 缺少跨端契约。
- 流水线集成测试：
  - `prd-spec-author` 输出可被 `prd-client-author` 正常消费；
  - 生成后的 per-client PRD 仍可通过 `prd-reviewer`。

### 验收标准

- `prd-spec-author` 能明确修正与 requirement 真源冲突的旧内容，而不是只保留旧文本。
- 共享 PRD 总源在通过时至少包含：
  - 产品意图
  - 客户端目标
  - 核心功能
  - 范围与非目标
  - 完整性覆盖
  - 部署架构
- 共享 PRD 总源可清晰表达关键用户流程、跨端边界和异常覆盖。
- 若 requirement 可追踪，PRD feature 至少保留轻量级来源映射。
- 不需要引入第三方 skill 也能完成默认主链。

## 8. 风险与回滚

### 风险

- 规则变强后，Agent-A 输出可能更长，增加 token 消耗；缓解措施：优先增加审查约束，不强制一次性扩写所有段落。
- “保留非空内容”放宽为“修正冲突内容”后，若规则写得不清楚，可能导致过度重写；缓解措施：明确保留/修正/删除三分法。
- 若过早引入 reviewer skill 到 runtime，可能拉长 `prd` 阶段耗时；缓解措施：先只改 author skill，再评估 reviewer wiring。
- traceability 设计过重会把 `prd-spec.md` 变成半结构化导出文件；缓解措施：采用轻量字段而非完整复制 requirement trace 字段。

### 回滚

- 若第一阶段升级后效果不稳定，可直接回滚 `prd-spec-author/SKILL.md` 与 README 改动，不影响脚本层。
- 若后续新增 `prd-spec-reviewer` 带来耗时或误报，可只在 `skills-template.yaml` 关闭该 reviewer 的默认启用，不必删除 skill 本体。
- 若轻量 traceability 列影响下游阅读体验，可先保留内部规则但不强制落盘显示。

## 9. 评审记录

### 第 1 轮评审

- 结论: 通过，方案已执行。
- 发现:
  - `prd-spec-author` 的核心职责已从“保留非空内容并补空白”升级为“保留有效内容、纠正 requirement 冲突并完成 coverage/quality loop”。
  - `SKILL.md` 已补入共享 PRD 最低契约、轻量 traceability、角色/流程/跨端边界/异常覆盖要求。
  - 中英文 README、`agents/openai.yaml`、`VERSION` 和 `CHANGELOG.md` 已同步，技能真源与展示文案保持一致。
- 修改:
  - 将代码实现状态更新为已执行，`实现文档版本` 更新为 `0.2.0`。
- 验证:
  - `rg -n "source coverage|quality review|traceability|角色与权限|跨端协作与接口契约" skills/prd-spec-author/SKILL.md`
  - `rg -n "preserve valid content|correct requirement conflicts|coverage/quality" skills/prd-spec-author/README.md skills/prd-spec-author/README.zh-CN.md`
  - `git diff --check`
