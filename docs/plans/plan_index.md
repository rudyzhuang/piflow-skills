---
title: piflow-skills plan_index
版本: 1.0.6
文档状态: 全部执行
评审状态: 全部评审
执行状态: 全部执行
创建时间: 2026-06-06 19:32
修改时间: 2026-06-21 15:06
作者: Codex
评审轮次: 10
评审结果: 通过
---

# piflow-skills plan_index

## 目录

- [1. 汇总状态](#1-汇总状态)
- [2. 来源文档](#2-来源文档)
- [3. 修改点清单](#3-修改点清单)
- [4. 矛盾与去重处理](#4-矛盾与去重处理)
- [5. 评审记录](#5-评审记录)

## 1. 汇总状态

- 目标项目: `/Users/guodongzhuang/github/piflow-skills`
- 文档目录: `/Users/guodongzhuang/github/piflow-skills/docs/plans`
- 评审状态: 全部评审
- 执行状态: 全部执行
- 文档状态: 全部执行
- 活跃修改点: 4
- 已评审修改点: 4
- 已执行修改点: 4
- 部分执行修改点: 0
- 未执行修改点: 0

## 2. 来源文档

- [req-reviewer 评审阶段 freeform_content 补全与来源标记方案](./20260606-1932-req-reviewer-freeform-content.md)
- [prd-spec-author 优化方案](./20260621-1410-prd-spec-author-optimization.md)
- [prd-client-author 优化方案](./20260621-1435-prd-client-author-optimization.md)
- [prd-reviewer 优化方案](./20260621-1455-prd-reviewer-optimization.md)

### 未纳入文档

- 无。当前 `docs/plans/` 下的 Markdown 方案均已纳入本索引。

## 3. 修改点清单

### PS-001 req-reviewer 评审阶段 freeform_content 补全与来源标记

- 来源:
  - [req-reviewer 评审阶段 freeform_content 补全与来源标记方案](./20260606-1932-req-reviewer-freeform-content.md)
- 活跃状态: 活跃
- 评审状态: 已评审
- 执行状态: 已执行
- 范围: `skills/req-reviewer/SKILL.md` 的评审和修订规则，`skills/req-maker/SKILL.md` 的 draft 输出契约，`skills/req-maker/assets/req-template.md` 的字段说明与示例，`skills/req-maker/scripts/export-req-md.mjs` 的来源枚举兼容和 Markdown 渲染规则。
- 当前结论: req.md 评审阶段必须补齐项目级和 feature 级 `freeform_content`。项目级字段位于 `## 核心功能 *` 头部，汇总项目整体功能描述；feature 级字段位于每个 `### Feature:` 块内，描述该功能的自然语言意图。用户原始描述经 AI 梳理后标记 `freeform_source: from_user`；AI 根据结构化字段推理补足时标记 `freeform_source: from_ai`。旧值 `user/ai` 保持兼容。`freeform_content/freeform_source` 属于给用户阅读和评审的 `req.md` 专用字段，不写入 `req.yaml`；同步链路只吸收其语义，写回前必须确定性剥离字段。
- 依赖: 现有 `req-maker` 模板中的 `freeform_content/freeform_source` 字段，现有 `req-reviewer` 多轮评审和直接修订流程，Backend export 对 `structured_source/freeform_source/freeform_content` 的追溯要求，piflow `req-sync` 写入 `req.yaml` 前的字段清洗守卫。
- 验收标准: 每个 Feature 块都有非空 `freeform_content`；每个 Feature 块的 `freeform_source` 与来源一致；`## 核心功能 *` 头部存在项目级 `freeform_content`；用户来源生成的整体功能描述标记 `from_user`；AI 汇总或推理补齐的描述标记 `from_ai`；旧值 `user/ai` 不导致校验失败；`freeform_content` 不包含密钥、token 或模板占位；`req.yaml` 的任意层级都不包含 `freeform_content/freeform_source`。
- 状态记录:
  - 2026-06-06 19:32: 根据用户关于 req.md 评审阶段 freeform_content 补全和来源标记的要求新增并评审方案。代码尚未执行，因此索引执行状态为 `未执行`。
  - 2026-06-06 19:47: 已执行。`req-reviewer` 已补充 freeform 必检、补齐和来源判定规则；`req-maker` draft/export 契约已同步；`export-req-md.mjs` 已兼容 `user/ai/from_user/from_ai` 并渲染 freeform 字段；新增 `self-test-export-freeform.mjs`。验证通过: `node --check` 两个脚本、`self-test-export-freeform`、`git diff --check`。
  - 2026-06-06 20:11: 第 3 轮补充评审和执行复核通过。确认 `freeform_content/freeform_source` 是 `req.md` 用户可读字段，不进入 `req.yaml`；已补充 piflow 同步链路的 prompt 约束、确定性清洗守卫和回归测试。验证通过: `node --check`、`self-test-req-sync`、`self-test-export-freeform`、`git diff --check`。

### PS-002 prd-spec-author 从增量补全器升级为共享 PRD 总源作者器

- 来源:
  - [prd-spec-author 优化方案](./20260621-1410-prd-spec-author-optimization.md)
- 活跃状态: 活跃
- 评审状态: 已评审
- 执行状态: 已执行
- 范围: `skills/prd-spec-author/SKILL.md` 的职责定义、保留策略、最低输出契约与自检闭环，`skills/prd-spec-author/README.md` / `README.zh-CN.md` 的说明文案，以及后续可能新增的 `prd-spec-reviewer` skill 与 `templates/skills-template.yaml` 的 reviewer wiring。
- 当前结论: `prd-spec-author` 当前更像共享 PRD 总源的增量补全器，缺少 requirement 到 PRD 的来源覆盖检查、质量复审闭环、冲突纠正规则和轻量 traceability 设计。推荐先强化官方 skill 本体，引入 `req-maker` / `req-reviewer` 中已验证有效的 coverage loop、quality loop 和“以上游真源为准”的修订机制，同时扩充 `prd-spec.md` 的最低契约，使其能表达用户流程、角色权限、跨端契约、异常处理和验收口径。`gstack/spec` 与 `superpowers-zh/writing-plans` 适合借鉴方法，不建议直接并入 `prd` 阶段默认主链。
- 依赖: 现有 `prd` 阶段 `req-maker -> req-reviewer -> prd-spec-author -> prd-client-author -> prd-reviewer` 主链，`templates/skills-template.yaml` 中 `prd` 阶段默认 skill 选择，`docs/stages/prd.md` 对 Agent-A 职责和总源契约的说明，`canonical-req.json` 持续作为上游业务真源。
- 验收标准: `prd-spec-author` 能在保留有效内容的同时修正与 requirement 真源冲突的旧内容；共享 PRD 总源在通过时至少完整覆盖产品意图、客户端目标、核心功能、范围与非目标、完整性覆盖、部署架构；共享 PRD 总源可清晰表达关键用户流程、跨端边界和异常覆盖；若 requirement 可追踪，PRD feature 至少保留轻量级来源映射；默认主链仍只依赖官方 skill 即可稳定运行。
- 状态记录:
  - 2026-06-21 14:10: 根据用户对 `prd-spec-author` 在 PiFlow 流水线中职责的评审要求新增方案文档。当前仅完成方案归档和索引登记，尚未修改 skill 本体，因此状态为 `未执行`、`待评审`。
  - 2026-06-21 15:05: 已执行。`prd-spec-author` 已升级为共享 PRD 总源作者器；补充 requirement 冲突纠正、source coverage / quality review loop、轻量 traceability 与共享 PRD 最低契约；README、agent 元数据、版本与 changelog 已同步。验证通过: `rg` 关键规则检查、`git diff --check`。

### PS-003 prd-client-author 从字段补全器升级为端内 PRD 合同作者器

- 来源:
  - [prd-client-author 优化方案](./20260621-1435-prd-client-author-optimization.md)
- 活跃状态: 活跃
- 评审状态: 已评审
- 执行状态: 已执行
- 范围: `skills/prd-client-author/SKILL.md` 的端内职责定义、shared feature 投影规则、端内质量复审、feature_list 同步规则和保留策略，`skills/prd-client-author/README.md` / `README.zh-CN.md` 的职责说明，以及与 `prompts/prd-client-author.md`、`prompts/prd-author-shared.md`、`prompts/admin-ui-shell.md` 之间的 authoring contract 边界整理。
- 当前结论: `prd-client-author` 当前已具备单端写入、字段补全和部分端特定规则，但整体更像“按端补字段的 Agent-B”，还不足以稳定承担“把 shared PRD 落成端内可执行合同”的角色。主要缺口在 shared feature 到当前端 feature 的投影规则、已有非空但语义过期字段的纠正规则、端内 feature completeness 闭环、以及 `feature_list` 作为 JSON 确定性投影的定义。结构上不建议当前按 client 硬拆成多个并行主 skill；推荐保留一个主 `prd-client-author` skill，先把共享 authoring contract 收敛进 skill，再对 `admin`、`backend` 这类高差异端按需引入 companion skill 或附录增强，由 reviewer 关注更高层的问题。
- 依赖: 现有 `prd-spec-author -> prd-client-author -> prd-reviewer` 主链，`docs/stages/prd.md` 对 Agent-B 的单端职责、feature_list fallback、deploy/build/config 同步和 mobile tech stack 规范化说明，当前各端模板与 prompt 中已有的 deploy/services、admin shell、backend tech_stack 和端字段格式契约。
- 验收标准: `prd-client-author` 能明确决定当前端应承接哪些 shared feature；每个端内 feature 都能体现当前端视角的合同描述而不是简单复写 shared summary；端特定字段不混用；`feature_list` 与 JSON 保持一致性投影；已有非空但与 shared PRD 或当前端 contract 冲突的字段会被修正；默认主链仍只依赖官方 skill 即可稳定运行。
- 状态记录:
  - 2026-06-21 14:35: 根据用户要求，按与 `prd-spec-author` 相同的标准完成 `prd-client-author` 评审并新增方案文档。当前仅完成文档归档和索引登记，尚未修改 skill 本体，因此状态为 `未执行`、`待评审`。
  - 2026-06-21 15:05: 已执行。`prd-client-author` 已升级为端内 PRD 合同作者器；补充 shared feature 投影规则、端特定字段边界、端内完整性复审和 `feature_list` 确定性投影；README、agent 元数据、版本与 changelog 已同步。验证通过: `rg` 关键规则检查、`git diff --check`。

### PS-004 prd-reviewer 从轻量 readiness reviewer 升级为证据化 PRD 门闸 reviewer

- 来源:
  - [prd-reviewer 优化方案](./20260621-1455-prd-reviewer-optimization.md)
- 活跃状态: 活跃
- 评审状态: 已评审
- 执行状态: 已执行
- 范围: `skills/prd-reviewer/SKILL.md` 的评审职责、输出分类、证据矩阵、自检闭环和 include/defer/block 规则，`skills/prd-reviewer/README.md` / `README.zh-CN.md` 的职责说明，以及与 `docs/stages/prd-review.md`、`prompts/prd-review-*.md`、后续 schema/script 增强之间的边界整理。
- 当前结论: `prd-reviewer` 当前边界正确，已经避免直接改写 PRD，但更像轻量 readiness reviewer，缺少证据矩阵、阻断/建议/澄清/建议反写分类、跨 `prd-spec.md`、各端 PRD、`feature_list`、`stages.prd.outputs.features[]` 的一致性检查，以及通过前的自检闭环。推荐升级为“证据化 PRD 门闸 reviewer”，借鉴 `office-hours` 的前提挑战、反方评审和完整性/一致性/清晰度/范围/可行性五维检查，但不引入其创业孵化、人机访谈或 builder coaching 形态。
- 依赖: 现有 `prd-spec-author -> prd-client-author -> prd-reviewer` 主链，`docs/stages/prd-review.md` 的 readiness gate 定义，`prompts/prd-review*.md` 的输出格式和阻断条件，PRD schema 对 `features[]`、`feature_list`、client PRD 的结构约束，以及后续 design/plan 阶段对 PRD 可执行性的依赖。
- 验收标准: reviewer 能覆盖每个可见 feature 并给出证据来源；所有 blocking issues 都能定位到具体文档、字段或阶段输出；通过状态不存在未解决 blocker；defer 项必须给出原因、影响和重新进入条件；recommendation 不阻断流水线但可被 author 后续采纳；自检覆盖完整性、一致性、清晰度、范围控制和实现可行性五个维度。
- 状态记录:
  - 2026-06-21 14:55: 根据用户要求，按与 `prd-spec-author`、`prd-client-author` 相同的标准完成 `prd-reviewer` 评审并新增方案文档。当前仅完成文档归档和索引登记，尚未修改 skill 本体，因此状态为 `未执行`、`待评审`。
  - 2026-06-21 15:05: 已执行。`prd-reviewer` 已升级为证据化 PRD 门闸 reviewer；补充 evidence matrix、blocking/recommendation/clarification 分级、跨产物一致性检查、review self-check 和端特定 checklist；README、agent 元数据、版本与 changelog 已同步。验证通过: `rg` 关键规则检查、`git diff --check`。

## 4. 矛盾与去重处理

- `req-maker` 旧 export 规则与本方案的关系: 旧规则说明 `freeform_content` 不作为独立字段渲染，只用于 description 兜底；本方案要求项目侧评审后的 `req.md` 显式保留 freeform 字段，用于后续 AI 评审和追溯。最终结论是 draft/评审态 req.md 应显式渲染，Backend export 可先兼容旧输入，但应同步渲染以避免生成与评审规则不一致。
- `user/ai` 与 `from_user/from_ai` 的关系: 旧枚举 `user/ai` 是来源类型，新枚举 `from_user/from_ai` 更明确表达来源事实。短期保持兼容，输出和评审推荐使用 `from_user/from_ai`。
- 项目级 `freeform_content` 与 `## 项目简介 *` 的关系: 项目简介描述产品定位和目标；`## 核心功能 *` 头部的项目级 freeform 汇总功能集合和整体能力边界。二者可相互呼应，但不应机械重复。
- `req.md` 与 `req.yaml` 的字段边界: `req.md` 保留 `freeform_content/freeform_source` 给用户阅读、确认和评审；`req.yaml` 不保存这些字段，只保存流水线消费的结构化字段。
- `prd-spec-author` 的“保留非空内容”与“以上游真源为准”的关系: 旧策略偏重避免误删，适合守住文档稳定性；新方案要求保留非冲突有效内容，但当 `canonical-req.json` 与旧 `prd-spec.md` 冲突时，必须以 requirement 真源纠正旧内容。最终结论是保留策略应升级为“保留有效内容”，而不是继续限制为“只补空白”。
- 第三方 skill 并入 `prd` 阶段的取舍: `gstack/spec` 和 `superpowers-zh/writing-plans` 都能提供方法参考，但它们的定位分别偏人工 spec 整理和实现计划编写，不理解 PiFlow `prd-spec.md` 的下游契约。最终结论是当前阶段只借鉴方法，不把第三方 skill 直接设为默认 stage skill。
- `prd-client-author` 与 `prd-reviewer` 的边界: 当前 reviewer 已经覆盖 target responsibility、feature decomposition、acceptance、edge/failure 和 implementation readiness，但 author skill 仍缺少足够强的自修订闭环。最终结论是 reviewer 应关注 readiness 和 blocker，而不是长期替 author 补基础字段和 feature_list 漂移问题。
- `prd-client-author` skill 与 prompt/附录真源的关系: 当前 deploy/services、backend tech_stack、admin ProLayout 等关键 authoring contract 分散在 `SKILL.md`、`prd-client-author.md`、`prd-author-shared.md` 和 `admin-ui-shell.md`。最终结论是 skill 应成为通用 authoring 规则主真源，prompt 和附录只保留端特定补充。
- `prd-client-author` 是否按 client 拆 skill: 当前 website/admin/backend/mobile 虽有明显差异，但共享 authoring 生命周期和主 contract 仍占大头。最终结论是不拆多个并行主 skill，而是保留一个主 skill，并为 `admin`、`backend` 预留 companion skill 扩展位。
- `prd-reviewer` 与 author skill 的边界: reviewer 不应直接改写 `prd-spec.md` 或端内 PRD，也不应长期替 author 补基础字段。最终结论是 reviewer 输出证据化阻断、建议、澄清和建议反写项，由 author skill 或流水线回写机制处理文档修订。
- `office-hours` 可借鉴范围: 可借鉴其前提挑战、反方评审、风险显性化和多维度完整性检查；不引入其 startup/builder coaching、人机访谈、用户实时交互或商业化孵化流程，避免偏离 PiFlow PRD 阶段的自动化门闸职责。
- 第三方 reviewer skill 的取舍: 当前仍保留一个官方 `prd-reviewer` 作为默认门闸，不把 `office-hours`、`gstack/spec` 或其他第三方 skill 直接并入默认主链；第三方方法只作为评审策略来源。

## 5. 评审记录

### 第 1 轮评审

- 结论: 通过
- 发现:
  - 新增方案目标项目为 `piflow-skills`，不是 `piflow`，因为主要修改 `req-reviewer` 和 `req-maker` skill 契约。
  - 方案覆盖项目级和 feature 级 freeform 字段，来源标记、兼容策略、生成规则和评审规则完整。
  - 方案识别了 `req-maker` 旧 export 规则与新评审规则的潜在冲突，并给出同步策略。
- 修改:
  - 新增 PS-001 修改点。

### 第 2 轮执行复核

- 结论: 通过
- 发现:
  - PS-001 已按方案落地到 `req-reviewer`、`req-maker` 和 export 脚本。
  - 新增自测覆盖旧来源枚举输入到新 `from_user/from_ai` 输出的规范化，以及项目级、feature 级、test case 级 `freeform_content` 渲染。
  - 当前仓库仍有同一批相关 `req-maker` 未提交修改，本次执行在其基础上增量完成，没有回退既有改动。
- 修改:
  - 将 PS-001 执行状态改为已执行。
  - 更新整体计数为 1 个活跃修改点、1 个已评审、1 个已执行、0 个未执行。

### 第 3 轮补充评审

- 结论: 通过
- 发现:
  - 用户补充的字段边界合理：`freeform_content/freeform_source` 是用户可读和评审辅助字段，不属于 `req.yaml` 结构化真源。
  - 仅靠 req-reviewer/req-maker 约束无法覆盖 Agent 合并后的 YAML 写回，因此需要在 piflow 同步链路增加确定性清洗守卫。
- 修改:
  - 更新 PS-001 当前结论、依赖、验收标准和矛盾处理。
  - 标记方案已补充第 3 轮评审结论。
  - 已执行 piflow 同步链路清洗守卫，并完成回归验证。

### 第 4 轮索引更新

- 结论: 通过
- 发现:
  - 新增 `prd-spec-author` 优化方案文档后，`docs/plans/` 已不再只有已执行项，因此索引总状态需要从“全部执行 / 全部评审”调整为“部分执行 / 部分评审”。
  - 新方案当前只是归档与索引登记，尚未落地到 skill 本体，应该明确标记为 `待评审`、`未执行`。
- 修改:
  - 新增 PS-002 修改点。
  - 更新来源文档、汇总计数、索引总状态和矛盾处理记录。

### 第 5 轮索引更新

- 结论: 通过
- 发现:
  - `prd-client-author` 的优化评审已形成独立方案，且性质与 `prd-spec-author` 类似，同样属于“已归档、未执行”的活跃修改点。
  - 新方案加入后，当前 `docs/plans/` 下共有 3 个活跃修改点，其中 2 个仍待评审、未执行。
- 修改:
  - 新增 PS-003 修改点。
  - 更新来源文档、汇总计数和矛盾处理记录。

### 第 6 轮方案细化

- 结论: 通过
- 发现:
  - `prd-client-author` 是否应按 client 拆成多个 skill 已有明确方向：当前不建议拆主 skill。
  - 更合适的路径是“单主 skill + 端特定 companion/附录增强”，其中 `admin`、`backend` 是最值得优先观察的高差异端。
- 修改:
  - 更新 PS-003 当前结论与矛盾处理，写明不拆多个并行主 skill 的决策。
  - 补充 `prd-client-author` 方案中的 companion skill 结构设计。

### 第 7 轮执行复核

- 结论: 通过
- 发现:
  - PS-002 已落地到 `skills/prd-spec-author` 的 `SKILL.md`、README、agent 元数据、版本和 changelog。
  - PS-003 已落地到 `skills/prd-client-author` 的 `SKILL.md`、README、agent 元数据、版本和 changelog。
  - 本轮未引入新的 reviewer wiring，保持默认主链仅依赖官方 author skill，与方案结论一致。
- 修改:
  - 将 PS-002、PS-003 更新为 `已评审`、`已执行`。
  - 更新整体状态与计数为全部评审、全部执行。

### 第 8 轮执行验证

- 结论: 通过
- 发现:
  - 文档类落地已覆盖方案要求的职责升级、复审闭环、冲突纠正、投影规则和 `feature_list` 一致性约束。
  - 本轮验证以规则关键字检查和 `git diff --check` 为主，未运行运行态流水线测试，因为本次修改仅涉及 skill 文档与元数据。
- 修改:
  - 回写两份源方案文档的 `代码实现`、`实现文档版本`、`评审结果` 与验证记录。

### 第 9 轮索引更新

- 结论: 通过
- 发现:
  - `prd-reviewer` 的优化评审已形成独立方案，属于“已归档、待评审、未执行”的新增活跃修改点。
  - 新方案加入后，当前 `docs/plans/` 下共有 4 个活跃修改点，其中 3 个已评审且已执行，1 个仍待评审、未执行。
  - `office-hours` 对 PRD 完整化最有价值的是前提挑战和反方评审方法，不适合直接替代 PiFlow 官方 reviewer。
- 修改:
  - 新增 PS-004 修改点。
  - 更新来源文档、汇总计数、索引总状态和矛盾处理记录。

### 第 10 轮执行复核

- 结论: 通过
- 发现:
  - PS-004 已落地到 `skills/prd-reviewer` 的 `SKILL.md`、README、agent 元数据、版本和 changelog。
  - 本轮实现保持 reviewer 只读门闸边界，没有把 reviewer 变成 PRD author 或正文修复器。
  - 当前 `docs/plans/` 下 4 个活跃修改点均已评审且已执行。
- 修改:
  - 将 PS-004 更新为 `已评审`、`已执行`。
  - 更新整体状态与计数为全部评审、全部执行。
