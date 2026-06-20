---
title: prd-client-author 优化方案
版本: 1.0.1
文档状态: 草稿
代码实现: 未执行
实现文档版本: 无
创建时间: 2026-06-21 14:35
修改时间: 2026-06-21 14:48
作者: Codex
评审轮次: 1
评审结果: 通过
来源上下文:
  - 用户要求按与 prd-spec-author 类似的标准评审 prd-client-author，并更新 piflow 方案文档
  - SKILL.md
  - README.zh-CN.md
  - ../prd-reviewer/SKILL.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-client-author.md
  - /Users/guodongzhuang/github/piflow/prompts/prd-author-shared.md
  - /Users/guodongzhuang/github/piflow/prompts/admin-ui-shell.md
  - /Users/guodongzhuang/github/piflow/docs/stages/prd.md
  - /Users/guodongzhuang/github/piflow/templates/prd-website-template.json
  - /Users/guodongzhuang/github/piflow/templates/prd-admin-template.json
  - /Users/guodongzhuang/github/piflow/templates/prd-backend-template.json
  - /Users/guodongzhuang/github/piflow/templates/prd-mobile-template.json
---

# prd-client-author 优化方案

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

`prd-client-author` 当前承担 PiFlow `prd` 阶段 Agent-B 角色，负责把共享总源 `output-stages/prd/prd-spec.md` 落到单个客户端目标的 `prd-<target>.json` 和 `feature_list-<client_target>.md`。它已经覆盖了“只改当前端”“保留已有非空字段”“维持跨端 `feature_id` 一致”“按端填入 `pages` / `api_calls` / `endpoints` / `roles` / `screens`”等核心约束，并由下游 `prd-reviewer` 和脚本层 schema / deploy sync 做进一步兜底。

但从“把共享产品规格稳定落成端内可执行 PRD 合同”的角度看，当前 skill 仍偏“字段级补全器”，对以下问题约束不足：

- 共享 PRD feature 到当前端 feature 的映射与筛选逻辑没有写透；
- 端内 feature 的职责边界、依赖、验收、路由/API/资源契约没有形成强制闭环；
- 模板示例、prompt 补充规则、端特定 shell 约束分散在多个文件中，skill 本体承载不足；
- 对“已有 JSON 非空但语义过期”的纠正规则不够明确；
- `feature_list` 只是摘要表，但没有被定义为对 JSON 的确定性投影，容易漂移。

### 目标

- 把 `prd-client-author` 从“按端增量补字段”升级为“按端生成可审查、可消费、可同步的 PRD 合同作者器”。
- 明确共享总源到端内 PRD 的 feature 映射、裁剪、继承与补充规则。
- 强化端内 PRD JSON 的最低契约，使其足够支撑 `prd-reviewer`、`design`、`ui-scenarios`、`codegen` 与 deploy/config 同步。
- 统一 skill、prompt、模板和附录约束的边界，减少规则分散导致的遗漏。
- 明确 skill 结构策略：保留一个主 `prd-client-author` skill，不按 client 硬拆成多个独立主 skill。
- 保持官方主链稳定，不直接以第三方 skill 取代分端 PRD authoring。

### 非目标

- 本方案不替换现有 `prd-client-author` 的单端写入边界。
- 本方案不修改 `prd-reviewer` 的 review JSON 结构。
- 本方案不直接改动 `scripts/stages/prd.cjs` 的 Agent-B 并发编排。
- 本方案不在本轮重新设计各端 JSON schema，只定义 authoring contract 的增强方向。

## 2. 当前状态与约束

### 当前状态

- `prd-client-author` 当前要求：
  - 只写当前端 `prd-<target>.json` 和 `feature_list-<client_target>.md`
  - 每个 feature 至少有 `feature_id/name/priority/phase/description/acceptance`
  - 顶层补 `product_intent/scope/completeness`
  - 按端使用正确字段名，如 backend 用 `endpoints`，website/mobile 用 `api_calls`
- `prompts/prd-client-author.md` 与 `prompts/prd-author-shared.md` 又补充了更强的约束：
  - `priority` 映射
  - `deploy.services` 的写法
  - backend `tech_stack` 与资源表达
  - `feature_list` 必须更新
  - admin 额外受到 `admin-ui-shell.md` 的壳层与视觉质量约束
- `docs/stages/prd.md` 已明确：
  - Agent-B 只处理当前端
  - 失败时脚本可能采纳既有合法产物继续
  - `feature_list` 缺失时脚本可 fallback 生成
  - mobile tech stack 会被脚本规范化
  - deploy/build/config 最终仍由脚本同步和裁剪

### 约束

- Agent-B 必须继续保持单端写入，不得跨端编辑。
- `prd-client-author` 输出必须兼容现有 Ajv schema、feature aggregation、deploy sync 和 build 配置回填。
- 端内 PRD 不是最终运行态 config；凡是 deterministic 可同步的内容，skill 只能写产品/部署语义，不能越权代替脚本做最终状态机。
- 已有非空字段保护仍有价值，因为 Agent-B 常在重试、采纳既有产物和增量修订场景运行。
- website/admin/backend/mobile 各端存在真实差异，不能只靠一套过于抽象的统一规则。

### 假设

- `prd-spec.md` 后续会继续作为所有端的共享语义总源。
- 当前端 JSON schema 会持续作为最低结构门槛，而不是完整语义门槛。
- `feature_list-<client_target>.md` 会继续保留，作为用户快速浏览和下游人工辅助入口。

## 3. 方案概述

- 保留 `prd-client-author` 作为官方 Agent-B authoring skill，不建议直接被 `gstack` 或 `superpowers-zh` 的通用文档/计划 skill 替代。
- 不建议当前按 `website/admin/backend/mobile` 硬拆成多个独立主 skill；更合适的是“一个主 skill + 端特定补充层”。
- 强化 skill 本体，让它承接当前散落在 prompt、shared prompt、admin 附录和 stage 文档中的关键 authoring contract。
- 引入“端内 feature 映射 + 端内质量复审”双层闭环：
  - 先决定当前端应该承接哪些 shared feature；
  - 再校验这些 feature 在当前端是否写成了可设计、可实现、可部署的端内合同。
- 重新定义“保留已有非空字段”的含义，升级为“保留有效字段，修正与 shared PRD / 端内契约冲突的旧字段”。
- 把 `feature_list` 定义为 JSON 的确定性投影，而不是一个随手维护的副文档。
- 对高差异端采用 companion 方案，而不是复制整套主规则：
  - `admin` 优先继续使用壳层附录或升级为 `prd-client-admin-companion`
  - `backend` 优先继续使用 shared prompt 中的 backend contract 或升级为 `prd-client-backend-companion`
- 第二阶段再考虑新增 `prd-client-reviewer` 或加强 `prd-reviewer` 前置自修订能力，但优先级低于强化 author skill 本体。

## 4. 详细设计

### 模块与职责

#### 4.1 `prd-client-author` 的职责升级

升级后的 `prd-client-author` 仍负责单端产物，但职责从“字段补全”扩大为“端内 PRD 合同生成与修订”，具体包括：

- 从共享 `prd-spec.md` 提取当前端应承担的 feature 集合与端内职责；
- 将 shared feature 正确投影为当前端 feature，补齐端内名称、描述、验收、页面/API/角色/资源等字段；
- 补充当前端专属的壳层、路由、交互表面、依赖和部署语义；
- 校验 `feature_list` 与端内 JSON 一致；
- 在完成前做端内 completeness review，而不是只检查字段是否存在。

#### 4.1.1 skill 结构决策

当前不建议把 `prd-client-author` 拆成 `prd-website-author-skill`、`prd-admin-author-skill`、`prd-backend-author-skill`、`prd-mobile-author-skill` 四个彼此平行的主 skill，原因是：

- 端内 authoring 的大部分核心规则仍然共享：
  - 只改当前端
  - 从 shared PRD 投影 feature
  - 复用 `feature_id`
  - 补齐 `product_intent/scope/completeness`
  - 同步 `feature_list`
  - 保留有效字段并修正冲突字段
- 如果拆成多个主 skill，规则很容易在 priority/phase 映射、feature 投影、保留策略、feature_list 生成、review loop 等层面漂移。
- 当前真正高差异的主要是端特定 contract，而不是主 authoring 生命周期。

因此推荐结构是：

- 主 skill：`prd-client-author`
  - 承载共享 authoring contract
- 端特定补充层：
  - prompt 补充
  - 附录约束
  - 后续如有必要，再升级成 companion skill

#### 4.1.2 companion skill 触发原则

若某一端后续继续增复杂，可以引入 companion skill，而不是拆主 skill。推荐判定标准：

- 仅当某一端同时具备以下特征时，才考虑 companion：
  - 独立输入上下文明显增多
  - 独立输出契约或字段族明显增多
  - 独立评审标准已经与其它端显著分叉
  - 独立演化节奏导致主 skill 频繁被端特定规则淹没

按当前情况，优先观察的端是：

- `admin`
  - 因为存在 ProLayout、默认 `/projects`、视觉质量基线等壳层规则
- `backend`
  - 因为存在 `tech_stack` 资源声明、`deploy.domain`、`deploy.services`、`endpoints/db_tables` 等强 contract

而 `website` 与 `mobile` 目前仍更适合留在主 skill 的通用规则下。

#### 4.2 建议新增职责：端内 feature 投影规则

建议在 skill 中显式定义 shared feature 到当前端的映射规则：

- 当前端只承接：
  - `client_targets` 包含当前端的 shared feature
  - 或 shared feature 是跨端基础能力，且当前端有明确表面或契约
- 当前端不应承接：
  - 与当前端无交互面、无 API 调用、无路由、无角色、无资源关系的 feature
  - 只是其它端的内部实现细节
- 对于跨端 feature：
  - `feature_id` 必须复用
  - 端内 `name/description/acceptance` 必须体现本端视角，而不是简单复制 shared summary

### 数据与接口

#### 4.3 端内 PRD JSON 最低契约升级

除现有字段外，建议把以下内容纳入硬性检查面：

- 顶层：
  - `client_target`
  - `project_name`
  - `tech_stack`
  - `product_intent`
  - `scope`
  - `completeness`
  - `features`
  - `auth`
  - `constraints`
- 每个 feature：
  - `feature_id`
  - `name`
  - `priority`
  - `phase`
  - `description`
  - `acceptance[]`
  - 当前端专属字段至少一类非空：
    - website/admin: `pages`
    - mobile: `screens`
    - backend: `endpoints`
  - 若与服务端通信相关：
    - web/mobile: `api_calls`
    - backend: `endpoints`
  - 若 feature 有前置依赖：`dependencies[]`

#### 4.4 `feature_list` 的确定性投影规则

建议把 `feature_list-<client_target>.md` 定义为从 JSON 确定性投影：

- 必须按 `features[]` 生成，不允许手写自由描述偏离 JSON；
- 至少包含：
  - `feature_id`
  - `name`
  - `priority`
  - `phase`
- 建议新增：
  - `surface`，如 `pages/screens/endpoints`
  - `status_note`，仅在需要标记 deferred / optional 时使用

这样即使脚本 fallback 生成，用户和 reviewer 看到的表也能保持一致语义。

#### 4.5 deploy / resources / shell 约束统一

当前 deploy 与端壳层约束分散在 skill、shared prompt、admin shell 附录和 stage 文档中。建议把最关键的 authoring 规则上移到 `prd-client-author`：

- backend:
  - `tech_stack` 是云资源声明的主权威输入；
  - `deploy.domain` 仅写 backend；
  - `features[].endpoints` 必须用 `string[]`
- website/admin:
  - `deploy.services[].url` 必须遵循同主域路径规则；
  - 不得写 apex 部署为默认值；
  - 不得引入其它端 deploy 条目
- admin:
  - 必须承接 `antd + ProLayout + /projects 默认落点` 语义
- mobile:
  - 可允许 framework/language 初稿不完整，但不得与 Flutter/Dart 方向明显冲突

#### 4.5.1 端特定补充层落点

推荐的补充层落点如下：

- `admin`
  - 短期：继续用 `admin-ui-shell.md` 作为附录补充
  - 中期：若规则继续膨胀，升级为 companion skill
- `backend`
  - 短期：继续用 `prd-author-shared.md` 中 backend contract 作为补充
  - 中期：若资源/部署/接口契约继续膨胀，升级为 companion skill
- `website`
  - 先留在主 skill + website prompt 组合，不单拆
- `mobile`
  - 先留在主 skill + mobile prompt 组合，不单拆

### 流程与状态

#### 4.6 推荐生成流程

升级后的 `prd-client-author` 推荐采用以下流程：

1. 读取 `prd-spec.md`、当前端 JSON、当前端 feature_list 草稿。
2. 识别当前端目标与模板契约。
3. 执行 shared feature selection：
   - 判断哪些 shared feature 属于当前端；
   - 判断哪些仅需保留依赖引用，不应落成本端 feature。
4. 执行 per-feature projection：
   - 为每个当前端 feature 补齐端内描述、验收、路由/API/资源字段；
   - 保持 `feature_id` 一致。
5. 执行 top-level completion：
   - 补齐 `product_intent/scope/completeness/tech_stack/auth/constraints/deploy`。
6. 执行 feature_list projection：
   - 从 JSON 生成或修正摘要表。
7. 执行端内 quality review loop：
   - 检查 feature completeness、端契约、依赖、验收、deploy 与 feature_list 一致性。
8. review 通过后结束。

#### 4.7 保留策略重定义

建议把现有“保留已有非空字段”升级为以下规则：

- 保留：
  - 与 shared PRD 和端内契约一致的已有字段；
  - 已有有效 `feature_id`；
  - 比 shared PRD 更具体、但不冲突的端内实现语义。
- 修正：
  - 与 shared PRD feature 含义不一致的端内描述；
  - 与当前端字段约定不符的旧字段，如 web 端误写 `endpoints`；
  - 与当前部署规则冲突的旧 `deploy.services[].url` 或 domain 示例。
- 删除或替换：
  - 仍残留模板示例值、占位接口、错误 UI 栈、过期 optional 资源条目；
  - 与当前端无关的 feature 字段或跨端 deploy 条目。

### 安全与权限

- `prd-client-author` 继续禁止写入 secrets、token、password、cookie、device key。
- 对 auth 只写产品级与端级语义，不写真实凭证。
- backend 若需要表达资源或鉴权，仅写契约，不写运行时秘钥或 header 示例中的真实值。

### 与 reviewer / script 的边界

#### 4.8 与 `prd-reviewer` 的边界

`prd-client-author` 应负责“把 PRD 写到足够可审”，`prd-reviewer` 负责“判断是否足够进入 design”。因此 author skill 应提前保证：

- 字段完整不是 reviewer 的唯一价值；
- reviewer 不应反复承担“帮 author 补基础字段”的工作；
- reviewer 主要关注 blocking issue、defer 决策、实现准备度和跨端矛盾。

#### 4.9 与脚本层的边界

脚本仍负责：

- schema 校验
- deploy/config/build 同步
- mobile tech stack 规范化
- 既有产物采纳与 fallback

但 author skill 应尽量减少“依赖脚本兜底才不出错”的情况，尤其是：

- feature 字段缺漏
- 端内字段名混用
- feature_list 漂移
- deploy URL 明显违约

### 第三方 skill 评估

#### 4.10 `superpowers-zh/writing-plans`

可借鉴点：

- 任务拆解和验收意识强；
- 自检导向明确。

不建议直接启用的原因：

- 它面向实现计划，不面向端内 PRD JSON 合同生成；
- 会引入计划文件写作语义，与 `prd-client-author` 目标不一致。

#### 4.11 `gstack/document-generate` / `gstack/spec`

可借鉴点：

- 对文档完整性和规格化表达有帮助；
- 适合人工梳理。

不建议直接启用的原因：

- 不理解 PiFlow 的端内 JSON schema、deploy sync、feature_id 继承和多端映射；
- 属于通用文档/规格 skill，无法替代 PRD stage 的专有 contract。

#### 4.12 结论

推荐策略是：

- 继续用官方 `prd-client-author` 做默认 Agent-B；
- 借鉴第三方 skill 的复审、自检和结构意识；
- 保留单主 skill，不按 client 拆成多个并行主 skill；
- 对 `admin`、`backend` 这类高差异端，优先采用 companion skill 或附录增强，而不是复制整套主 skill；
- 不把第三方 skill 直接并为 `prd` 阶段默认 authoring skill。

## 5. 实施计划

### 阶段 1: 强化 `prd-client-author`

- 修改 `SKILL.md`：
  - 补 shared feature selection 规则；
  - 补端内 feature projection 规则；
  - 补端内 quality review loop；
  - 补 `feature_list` 确定性投影规则；
  - 补保留/修正/删除三分法。
- 更新 README 中对职责的描述，从“只补字段”升级为“输出端内 PRD 合同”。

验证方式：

- 使用 website/admin/backend/mobile 四类样本分别生成或增量修订；
- 验证错误字段名、旧 deploy URL、模板占位接口会被纠正；
- 验证 feature_list 与 JSON 保持一致。

### 阶段 2: 收敛分散约束

- 将 shared prompt / admin shell 中最关键、最通用的 authoring contract 上移到 skill；
- 保留附录文件，但把它们降级为端特定补充，而不是主约束真源。
- 为后续 companion skill 预留接口，但本阶段不拆主 skill。

验证方式：

- 对 admin 端验证 ProLayout、默认 `/projects`、同主域 `/admin/` 规则仍能稳定进入输出；
- 对 backend 端验证 `tech_stack` 与 `deploy` 契约不会丢失。

### 阶段 2.5: 评估 companion skill 而非主 skill 拆分

- 若 `admin` 或 `backend` 规则继续显著膨胀，新增 companion skill 设计草案：
  - `prd-client-admin-companion`
  - `prd-client-backend-companion`
- companion 只补充端特定 contract，不复制主 skill 的通用规则。

验证方式：

- 验证主 skill 仍能独立工作；
- 验证 companion 启用后只增强端特定行为，不改变其它端逻辑。

### 阶段 3: 评估 reviewer 补强

- 若 author skill 强化后仍有大量 reviewer 在补基础字段，可考虑：
  - 新增 `prd-client-precheck` reviewer
  - 或增强 `prd-reviewer` 的“发现即建议 author 修正”的闭环

验证方式：

- 统计 reviewer 的 blocking issue 是否从“基础字段缺漏”转向“真实产品问题”。

### 依赖与排期

- 推荐顺序：先改 `prd-client-author`，再评估是否需要 reviewer 侧补强。
- 第一阶段即可独立带来收益，不依赖脚本改造。
- 第二阶段主要是整理规则真源，风险可控。

## 6. 兼容性与迁移

- 兼容现有各端 `prd-*.json` 路径与 schema。
- 对已有项目的兼容策略：
  - 保留有效 `feature_id`
  - 保留与 shared PRD 一致的非空字段
  - 修正明显错误字段名和部署示例值
- `feature_list` 若新增列，应优先保持向后兼容；旧消费者至少还能读取原四列信息。
- 强化后不应要求引入任何新的第三方 skill 才能通过默认 `prd` 主链。

## 7. 测试与验收

### 测试计划

- website:
  - `pages/api_calls/deploy.services` 的字段与 URL 规则
- admin:
  - `pages/roles/tech_stack/constraints` 与 admin shell 约束
- backend:
  - `tech_stack/endpoints/db_tables/deploy.domain/services`
- mobile:
  - `screens/api_calls/tech_stack` 与增量修订兼容
- 交叉测试:
  - shared feature 同步到多个端时 `feature_id` 一致
  - feature_list 与 JSON 一致
  - 旧 JSON 中错误占位值会被替换

### 验收标准

- `prd-client-author` 能明确决定当前端应承接哪些 shared feature，而不是机械复制或遗漏。
- 每个输出端内 feature 都是当前端视角的合同描述，而不是 shared summary 的无差别复写。
- 当前端关键字段正确、端特定字段不混用。
- `feature_list` 成为 JSON 的一致性投影，不再独立漂移。
- reviewer 的主要问题类型转向产品/设计准备度，而不是 author 基础缺漏。

## 8. 风险与回滚

### 风险

- skill 规则增强后，Agent-B 单端生成耗时可能上升；缓解措施：优先提升关键 contract，不要求一次性扩写所有描述。
- 端内映射规则写得过重，可能导致 feature 过度裁剪或重复；缓解措施：先围绕 shared feature 的 `client_targets` 和显式依赖做最小可用规则。
- 将分散约束上移时，若重复或冲突处理不好，可能造成 skill 与 prompt 双重真源；缓解措施：明确 skill 为主、prompt 为补充。

### 回滚

- 若强化后的 `SKILL.md` 导致产物不稳定，可回滚 skill 与 README，不影响脚本层。
- 若 `feature_list` 新规则影响既有阅读习惯，可先只强化“确定性同步”，暂不加新列。
- 若端特定约束上移造成噪声，可保留在附录文件中，仅在 skill 中保留最小强制项。

## 9. 评审记录

### 第 1 轮评审

- 结论: 通过
- 发现:
  - `prd-client-author` 当前虽然存在明显端差异，但主 authoring 生命周期和大部分 contract 仍共享，不适合立即拆成多个并行主 skill。
  - 更合理的结构是“一个主 skill + 端特定补充层”，先把共享 authoring contract 收敛到主 skill，再视 `admin`、`backend` 的复杂度决定是否引入 companion skill。
  - `admin` 和 `backend` 是最可能需要 companion 的两个端，但目前还没到必须拆主 skill 的程度。
- 修改:
  - 补充单主 skill / companion skill 的结构决策、判定标准和实施阶段。
