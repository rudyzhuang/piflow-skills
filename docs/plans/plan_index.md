---
title: piflow-skills plan_index
版本: 1.0.0
文档状态: 全部执行
评审状态: 全部评审
执行状态: 全部执行
创建时间: 2026-06-06 19:32
修改时间: 2026-06-06 20:11
作者: Codex
评审轮次: 2
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
- 活跃修改点: 1
- 已评审修改点: 1
- 已执行修改点: 1
- 部分执行修改点: 0
- 未执行修改点: 0

## 2. 来源文档

- [req-reviewer 评审阶段 freeform_content 补全与来源标记方案](./20260606-1932-req-reviewer-freeform-content.md)

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

## 4. 矛盾与去重处理

- `req-maker` 旧 export 规则与本方案的关系: 旧规则说明 `freeform_content` 不作为独立字段渲染，只用于 description 兜底；本方案要求项目侧评审后的 `req.md` 显式保留 freeform 字段，用于后续 AI 评审和追溯。最终结论是 draft/评审态 req.md 应显式渲染，Backend export 可先兼容旧输入，但应同步渲染以避免生成与评审规则不一致。
- `user/ai` 与 `from_user/from_ai` 的关系: 旧枚举 `user/ai` 是来源类型，新枚举 `from_user/from_ai` 更明确表达来源事实。短期保持兼容，输出和评审推荐使用 `from_user/from_ai`。
- 项目级 `freeform_content` 与 `## 项目简介 *` 的关系: 项目简介描述产品定位和目标；`## 核心功能 *` 头部的项目级 freeform 汇总功能集合和整体能力边界。二者可相互呼应，但不应机械重复。
- `req.md` 与 `req.yaml` 的字段边界: `req.md` 保留 `freeform_content/freeform_source` 给用户阅读、确认和评审；`req.yaml` 不保存这些字段，只保存流水线消费的结构化字段。

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
