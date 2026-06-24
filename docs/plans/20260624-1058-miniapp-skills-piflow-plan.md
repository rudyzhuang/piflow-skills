---
title: 小程序官方 skill 组与 PiFlow unit 接入方案
版本: 1.0.1
文档状态: 已评审
代码实现: 未执行
实现文档版本: 0.1.0
创建时间: 2026-06-24 10:58
修改时间: 2026-06-24 11:30
作者: Codex
评审轮次: 2
评审结果: 通过
来源上下文:
  - 用户要求基于飞书文档评审微信、抖音、支付宝等小程序开发 skill 是否可作为 PiFlow 官方 skill
  - /Users/guodongzhuang/Downloads/小程序skill参考.md
  - 用户补充的 Taro 跨端技术说明（React + TypeScript + Taro）
  - /Users/guodongzhuang/github/piflow/skill-libraries/libs/flutter_official_repo
  - /Users/guodongzhuang/github/piflow/templates/skills-template.yaml
  - /Users/guodongzhuang/github/piflow/templates/prompts-template.yaml
  - skills/*/SKILL.md
  - skills/*/VERSION
  - skills/*/README.md
  - skills/*/README.zh-CN.md
  - skills/*/CHANGELOG.md
  - skills/*/install.mjs
---

# 小程序官方 skill 组与 PiFlow unit 接入方案

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 当前状态与约束](#2-当前状态与约束)
- [3. 方案概述](#3-方案概述)
- [4. Skill 拆分设计](#4-skill-拆分设计)
- [5. PiFlow unit 接入设计](#5-piflow-unit-接入设计)
- [6. 文件与版本规范](#6-文件与版本规范)
- [7. 实施计划](#7-实施计划)
- [8. 测试与验收](#8-测试与验收)
- [9. 风险与治理](#9-风险与治理)
- [10. 评审记录](#10-评审记录)

## 1. 背景与目标

### 背景

- 用户提供的《小程序skill参考》文档以 TRAE Skill 体系为参照，覆盖跨平台基础规范、微信/抖音/支付宝/百度平台专项规范，以及需求、设计、开发、测试、发布、运维等生命周期阶段。
- PiFlow 已经通过 `skill-libraries/libs/flutter_official_repo` 接入 Flutter 官方 skill，并在 `templates/skills-template.yaml` 中为 `codegen` 和 `test` 配置了 `mobile_flutter` unit。
- 小程序开发与 Flutter 类似，既有通用工程规范，也有平台专项差异，因此适合采用“多个能力 skill + unit 组合”的方式接入，而不是创建一个巨大的全平台 skill。
- AI 生态里 React 与 TypeScript 的生成能力成熟，Taro 作为跨端小程序基底与 PRD→Design→Code 的流水线更贴合，适合作为 foundation 的默认实现方式。

### 目标

- 设计一组 PiFlow 官方小程序 skill，覆盖微信、抖音、支付宝等平台的小程序开发。
- 明确 `miniapp-cross-platform-foundation` 与平台专项 skill 的关系和组合方式。
- 给出可直接进入下一步创建 skill 的文件规范，包括 `SKILL.md`、`VERSION`、`README.md`、`README.zh-CN.md`、`CHANGELOG.md`、`install.mjs`、`agents/openai.yaml`。
- 给出 PiFlow `skill.yaml` 治理元数据和 `templates/skills-template.yaml` unit wiring 建议。
- 将 foundation 明确为 Taro-first：`design-spec.yaml -> React/Taro -> taro build -> 微信/抖音/支付宝小程序`。
- 控制首版范围，避免把未经核验的平台规则、效率案例和高风险发布动作直接写成默认自动化规则。

### 非目标

- 本方案不创建实际 `skills/miniapp-*` 目录。
- 本方案不修改 PiFlow runtime、模板、schema 或 pipeline stage。
- 本方案不把飞书文档中的全部平台规则原样转为官方强约束；高时效和合规规则需要后续核验官方文档后再进入 skill。
- 本方案不默认实现自动提交审核、线上发布、真实平台上传等高风险动作。

## 2. 当前状态与约束

### 当前状态

- `piflow-skills` 中每个正式 skill 目录通常包含：
  - `SKILL.md`
  - `VERSION`
  - `CHANGELOG.md`
  - `README.md`
  - `README.zh-CN.md`
  - `install.mjs`
  - 可选 `agents/openai.yaml`
  - 可选 `references/`、`scripts/`、`schemas/`、`tests/`
- 根安装器会按 skill 名称安装，skill-local `install.mjs` 通常只是调用仓库根 `install.mjs` 的兼容 wrapper。
- PiFlow 的 `templates/skills-template.yaml` 已有 unit 级注入能力，例如 `mobile_flutter` 在 `codegen` 阶段追加 Flutter layout/json skill，在 `test` 阶段追加 widget/integration test skill。
- `flutter_official_repo` 的粒度是“一项开发能力一个 skill”，而不是一个 Flutter 总 skill。

### 约束

- 新 skill 名称使用小写 hyphen，建议前缀统一为 `miniapp-`。
- 首版版本建议均为 `0.1.0`。
- `SKILL.md` 应保持精炼，保留核心工作流和决策规则；平台长表、官方文档链接、差异矩阵可放入 `references/`。
- 发布、上传、提交审核等动作默认不自动启用，必须显式 capability 或用户授权。
- 平台规则变化频繁，skill 中不应写“永久有效”的细节结论；高风险合规规则应要求核对官方文档或用户确认。
- 文档中的“2026 最新规则”、提效案例、收益数据不能未经核验进入官方 skill 强约束。

## 3. 方案概述

首版建议创建 5 个必需 skill，后续按真实项目需要扩展百度和发布自动化：

1. `miniapp-cross-platform-foundation`
   - 小程序跨平台底座 skill（Taro-first）。
   - 识别 Taro、uni-app、原生微信、原生抖音、原生支付宝或混合项目；Taro 为默认路径。
   - 统一目录、命名、条件编译、公共 adapter、请求/存储/权限/导航/分享/支付入口、状态管理、多环境配置和基础包体质量约束。

2. `miniapp-platform-wechat`
   - 微信小程序专项 skill。
   - 覆盖 `wx.*` API、微信项目配置、微信开发者工具、隐私授权、分包、性能、审核前检查。

3. `miniapp-platform-douyin`
   - 抖音小程序专项 skill。
   - 覆盖 `tt.*` API、抖音开发者工具、视频/直播/挂载能力、内容安全、企业主体能力、权限授权、审核前检查。

4. `miniapp-platform-alipay`
   - 支付宝小程序专项 skill。
   - 覆盖 `my.*` API、支付宝项目配置、支付/会员/商业能力、IoT 限制、安全与跳转规则、审核前检查。

5. `miniapp-quality-and-compliance`
   - 小程序质量与合规 skill。
   - 覆盖测试、包体积、启动性能、权限、隐私、内容安全、审核材料、平台开发者工具验证证据。

后续可选 skill：

- `miniapp-platform-baidu`
  - 百度智能小程序专项。当前飞书文档中百度部分较概括，建议等真实项目或官方规则核验后再拆。
- `miniapp-release`
  - 构建、预览、上传、提交审核、版本发布。默认 catalog-only，不进入默认 `deploy` unit。

## 4. Skill 拆分设计

### 4.1 miniapp-cross-platform-foundation

定位：所有小程序项目共用的底层开发规范，负责让 agent 先把项目地基搭稳。默认采用 Taro 跨端工程模型，让代码以统一方式覆盖微信、抖音、支付宝。

触发场景：

- 用户要求开发微信、抖音、支付宝、百度、跨平台小程序。
- PiFlow codegen unit 识别到 `client_target=miniapp` 或 `framework` 为 `taro`、`uni-app`、`native-miniapp`。
- 现有项目需要统一跨端架构、条件编译、adapter 和公共能力封装。

核心规则：

- 编辑前先识别项目类型：Taro、uni-app、原生微信、原生抖音、原生支付宝、混合 monorepo。
- Foundation 默认技术栈为 `React + TypeScript + Taro`，统一 `src/pages`、`src/components`、`src/utils`、`src/platform` 与配置目录。
- 共享业务逻辑保持平台无关；平台 API 必须放在 adapter 或平台目录中。
- 平台差异优先使用框架官方条件编译或推荐 adapter，不在页面中散落运行时平台判断。
- 约定核心编译流：`design-spec.yaml -> React/Taro TSX -> taro build --type weapp/tt/alipay`。
- 请求、登录、存储、权限、导航、分享、支付入口、多环境配置必须集中封装。
- 页面、组件、接口、工具、状态、静态资源目录边界清楚。
- 禁止在页面或组件中硬编码 API host、appid、secret、token、上传密钥。
- 支持平台专项 skill 接在后面补充实现细节。

建议目录结构：

```text
skills/miniapp-cross-platform-foundation/
  SKILL.md
  VERSION
  CHANGELOG.md
  README.md
  README.zh-CN.md
  install.mjs
  agents/
    openai.yaml
  references/
    taro-stack.md
    framework-detection.md
    project-structure.md
    platform-adapters.md
    design-spec-contract.md
    conditional-compilation.md
    package-size-and-performance.md
```

### 4.1.1 Taro 实施约束（foundation 内部必须项）

- 输入以 `design-spec.yaml`、`feature schema`、或内部统一页面组件规格为主，`UI Agent` 先产生 `pages/components/theme`。
- `Codegen` 产物优先为 Taro 组件与 hooks，不生成 `wx/tt/my` 直接写法。
- 页面级逻辑只能通过 adapter 间接调用平台能力，所有平台差异落到 `src/platform/{wechat,douyin,alipay}`。
- `Build matrix` 必须支持至少一键切换：`weapp`、`tt`、`alipay`。

### 4.2 miniapp-platform-wechat

定位：微信平台专项规则，不重复通用架构。

依赖关系：

- 与 `miniapp-cross-platform-foundation` companion 使用。
- 单平台微信项目也建议同时启用 foundation 和 wechat。

核心内容：

- 微信原生项目结构、`app.json`、`project.config.json`、页面和组件组织。
- `wx.*` API 使用边界、Promise 包装、错误处理和统一 adapter。
- 用户授权、隐私弹窗、敏感权限按需申请、拒绝授权后的替代路径。
- 分包、首屏、`setData` 数据量和调用频率、长列表优化。
- 微信开发者工具编译、预览、真机调试、审核材料检查。

建议 references：

```text
references/
  wechat-project.md
  wechat-api-adapter.md
  wechat-auth-privacy.md
  wechat-performance.md
  wechat-review-checklist.md
```

### 4.3 miniapp-platform-douyin

定位：抖音平台专项规则，尤其处理内容、视频、直播和挂载能力。

核心内容：

- 抖音原生项目结构、`ttml`、`ttss`、`tt.*` API。
- 抖音开发者工具编译、预览、真机调试。
- 视频播放、媒体能力、直播/小雪花/挂载相关能力的能力申请前置检查。
- 内容安全、用户生成内容、AI 生成内容、未成年人保护、电商内容风险提示。
- 抖音账号授权、敏感权限、企业主体能力和审核材料。

治理要求：

- 飞书文档中的“2026 年起个人主体禁止某能力”等规则必须在正式写入 skill 前核验官方文档。
- skill 可以要求“涉及直播挂载、企业号、支付、内容安全时必须核对官方规则”，但不要把未经核验的日期和政策写死成不可变事实。

### 4.4 miniapp-platform-alipay

定位：支付宝平台专项规则，强调支付、商业、会员、IoT 与资金安全。

核心内容：

- 支付宝项目配置、`my.*` API、页面/组件差异。
- 支付、会员、商业能力入口封装与异常处理。
- IoT 小程序企业主体和服务边界检查。
- 禁止把核心服务通过跳转其他小程序规避实现。
- 资金相关流程必须有失败、取消、重试、幂等、对账或订单状态保护。

治理要求：

- 涉及支付、储值、预付卡、资金、会员权益的内容必须提示核对官方运营和安全规范。
- 自动发布或提交审核不属于本 skill 默认职责。

### 4.5 miniapp-quality-and-compliance

定位：测试、性能、隐私、权限和审核前门闸。

适用阶段：

- `test`
- `code-review`
- 发布前人工或自动检查

核心内容：

- 生成或补充单元测试、组件测试、集成测试、关键链路冒烟测试。
- 检查包体积、分包、首屏、长列表、图片和视频资源。
- 扫描硬编码 secret、appid/token 泄漏、未集中封装的 API host。
- 检查敏感权限是否按使用时申请，是否有用户拒绝后的替代路径。
- 输出开发者工具、真机调试、截图、测试账号、测试路径等审核证据清单。

### 4.6 miniapp-release

定位：构建、预览、上传、提交审核、版本发布。

首版建议：

- 先只做方案和 catalog-only skill，不进入默认 unit。
- 需要显式用户授权、平台凭证配置和目标环境确认。
- 任何提交审核、发布线上版本、改动平台配置的动作都必须被 PiFlow request 或用户消息明确授权。

## 5. PiFlow unit 接入设计

### 单平台项目

微信：

```yaml
enabled:
  codegen:
    units:
      miniapp_wechat:
        mode: append
        skills:
          - miniapp-cross-platform-foundation
          - miniapp-platform-wechat
          - miniapp-quality-and-compliance
    unit_rules:
      - match:
          client_target: miniapp
          framework: wechat-miniapp
        use_unit: miniapp_wechat
  test:
    units:
      miniapp:
        mode: append
        skills:
          - miniapp-quality-and-compliance
```

抖音：

```yaml
enabled:
  codegen:
    units:
      miniapp_douyin:
        mode: append
        skills:
          - miniapp-cross-platform-foundation
          - miniapp-platform-douyin
          - miniapp-quality-and-compliance
    unit_rules:
      - match:
          client_target: miniapp
          framework: douyin-miniapp
        use_unit: miniapp_douyin
```

支付宝：

```yaml
enabled:
  codegen:
    units:
      miniapp_alipay:
        mode: append
        skills:
          - miniapp-cross-platform-foundation
          - miniapp-platform-alipay
          - miniapp-quality-and-compliance
    unit_rules:
      - match:
          client_target: miniapp
          framework: alipay-miniapp
        use_unit: miniapp_alipay
```

### 跨平台项目

当 PRD 明确要求一套代码发布微信、抖音、支付宝时，启用组合 unit：

```yaml
enabled:
  codegen:
    units:
      miniapp_multi:
        mode: append
        skills:
          - miniapp-cross-platform-foundation
          - miniapp-platform-wechat
          - miniapp-platform-douyin
          - miniapp-platform-alipay
          - miniapp-quality-and-compliance
    unit_rules:
      - match:
          client_target: miniapp
          framework: uni-app
        use_unit: miniapp_multi
      - match:
          client_target: miniapp
          framework: taro
        use_unit: miniapp_multi
```

### 推荐策略

- 默认按目标平台拆 unit，减少无关平台规则干扰。
- 只有明确多平台交付时才启用 `miniapp_multi`。
- `miniapp-cross-platform-foundation` 与平台专项 skill 可以并列配置在同一 unit 中。
- 平台专项 skill 不应重复 foundation 的目录、命名、adapter 原则，只补平台行为。
- `miniapp-release` 暂不进入默认 `deploy`；后续通过显式 capability 启用。

## 6. 文件与版本规范

### 每个 skill 的基础文件

```text
skills/<skill-name>/
  SKILL.md
  VERSION
  CHANGELOG.md
  README.md
  README.zh-CN.md
  install.mjs
  agents/
    openai.yaml
```

### SKILL.md

要求：

- frontmatter 必须包含 `name` 和 `description`。
- `description` 要写清楚触发场景，例如小程序、微信、抖音、支付宝、uni-app、Taro、跨平台开发、PiFlow codegen/test。
- Body 保持精炼，按“何时使用、核心流程、规则、检查清单、何时读取 references”组织。
- 不在 `SKILL.md` 中塞长篇平台百科。

示例 frontmatter：

```markdown
---
name: miniapp-cross-platform-foundation
description: Use when implementing or refactoring React + TypeScript + Taro miniapp projects for WeChat, Douyin, or Alipay, especially in PiFlow codegen units that need shared project structure, platform adapters, conditional compilation, API abstraction, and baseline cross-platform QA before platform-specific tuning.
---
```

### 6.1 可执行的 Taro 约束（建议写入 foundation SKILL.md）

- 不在业务组件中直接使用 `wx`、`tt`、`my` 全局对象。
- 平台能力入口集中在 `src/platform` 目录，按 `wechat`、`douyin`、`alipay` 分层。
- `design-spec.yaml` 与页面/组件规格映射后再生成 TSX。
- 编译能力固定支持：
  - `taro build --type weapp`
  - `taro build --type tt`
  - `taro build --type alipay`

### VERSION

- 首版均为：

```text
0.1.0
```

- 后续每次新增平台规则、扩大自动化行为、改变 unit 推荐方式，都需要更新版本。

### CHANGELOG.md

首版示例：

```markdown
# Changelog

## 0.1.0 - 2026-06-24

- Added initial `miniapp-cross-platform-foundation` skill.
- Added PiFlow codegen unit guidance for miniapp projects.
- Added framework detection, platform adapter, conditional compilation, and shared miniapp project structure rules.
```

### README.md / README.zh-CN.md

README 需要包含：

- skill 用途。
- 中文文档或英文文档互链。
- 安装方式：

```bash
node install.mjs miniapp-cross-platform-foundation
```

或：

```bash
cd skills/miniapp-cross-platform-foundation
node install.mjs
```

- PiFlow unit 示例。
- 与 companion skill 的关系。
- 风险说明，例如高风险平台规则需核对官方文档。

### install.mjs

沿用现有 wrapper：

```js
#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const skillDir = path.dirname(fileURLToPath(import.meta.url));
const repoInstaller = path.resolve(skillDir, "..", "..", "install.mjs");
const result = spawnSync(process.execPath, [repoInstaller, path.basename(skillDir), ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  console.error(`ERROR: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
```

### agents/openai.yaml

每个 skill 建议提供 UI 元数据。

示例：

```yaml
name: miniapp-cross-platform-foundation
interfaces:
  openai:
    display_name: Miniapp Cross-Platform Foundation
    short_description: Establish shared structure, adapters, and cross-platform rules for miniapp projects.
    default_prompt: "Use $miniapp-cross-platform-foundation to identify the miniapp framework, enforce React + TypeScript + Taro base codegen, route platform capabilities via src/platform adapters, and guide PiFlow codegen for WeChat/Douyin/Alipay."
```

### PiFlow skill.yaml 元数据

在 `/Users/guodongzhuang/github/piflow/skill-libraries/libs/piflow_official_repo/<skill-name>/skill.yaml` 中生成治理元数据。

示例：

```yaml
name: miniapp-cross-platform-foundation
version: 0.1.0
source:
  library: piflow_official_repo
  repo: https://github.com/rudyzhuang/piflow-skills.git
  ref: main
  path: piflow/skill-libraries/repos/piflow-skills/skills/miniapp-cross-platform-foundation
license: unknown
tags:
  - piflow_official_repo
  - miniapp
  - cross-platform
  - uni-app
  - taro
  - wechat
  - douyin
  - alipay
summary: Establish shared project structure, adapters, conditional compilation, and baseline quality rules for cross-platform miniapp development.
applicability:
  stage:
    - codegen
  role:
    - mobile_development
    - frontend_development
  client_target:
    - miniapp
  framework:
    - miniapp
    - uni-app
    - taro
    - native-miniapp
  cloud: []
  domain:
    - mobile-app
    - mini-program
    - cross-platform
injection:
  prompt_fragments:
    - SKILL.md
  checklist:
    - Identify the miniapp framework before editing.
    - Keep shared business logic platform-neutral.
    - Put platform-specific APIs behind adapters.
    - Use framework-supported conditional compilation for platform differences.
  examples:
    - Build a uni-app miniapp feature that targets WeChat and Douyin with shared business logic and platform adapters.
    - Build a React + Taro feature from design-spec.yaml and compile it for WeChat/Douyin/Alipay.
  constraints:
    - Do not hard-code API hosts, app ids, tokens, secrets, or upload keys in pages or components.
    - Do not duplicate the same feature per platform unless platform behavior truly differs.
output_controls:
  schema_patch: null
  review_rules:
    - Check that platform APIs are isolated behind adapters and that target platform differences are explicit.
risk_level: code-write
composition:
  priority: 100
  provides:
    - piflow_official_repo.miniapp-cross-platform-foundation
  requires: []
  conflicts_with: []
selection:
  role: disabled
  capability: piflow_official_repo.miniapp-cross-platform-foundation
  fallback_for: []
  companion_with:
    - miniapp-platform-wechat
    - miniapp-platform-douyin
    - miniapp-platform-alipay
  reason: >-
    piflow_official_repo skill is catalog-only by default; enable it in miniapp codegen units
    when a project targets miniapp platforms.
usage:
  recommended_wiring: enabled_stage_unit
  stage_examples:
    - |-
      enabled:
        codegen:
          units:
            miniapp_wechat:
              mode: append
              skills:
                - miniapp-cross-platform-foundation
                - miniapp-platform-wechat
                - miniapp-quality-and-compliance
  policy_notes:
    - code-write 默认 deny；若启用到 codegen，需要在 skills.yaml policy.stages.codegen.code-write 设置 allow。
```

## 7. 实施计划

### Phase 1: 方案落地为 skill skeleton

- 新增 5 个 skill 目录：
  - `skills/miniapp-cross-platform-foundation/`
  - `skills/miniapp-platform-wechat/`
  - `skills/miniapp-platform-douyin/`
  - `skills/miniapp-platform-alipay/`
  - `skills/miniapp-quality-and-compliance/`
- foundation 目录补齐 references：
  - `references/taro-stack.md`
  - `references/design-spec-contract.md`
- 每个目录补齐 `SKILL.md`、`VERSION`、`CHANGELOG.md`、`README.md`、`README.zh-CN.md`、`install.mjs`、`agents/openai.yaml`。
- 根 `README.md` 和 `README.zh-CN.md` 登记新 skill。

### Phase 2: 生成 PiFlow 治理元数据

- 在 PiFlow 仓库中生成：
  - `skill-libraries/libs/piflow_official_repo/miniapp-cross-platform-foundation/skill.yaml`
  - `skill-libraries/libs/piflow_official_repo/miniapp-platform-wechat/skill.yaml`
  - `skill-libraries/libs/piflow_official_repo/miniapp-platform-douyin/skill.yaml`
  - `skill-libraries/libs/piflow_official_repo/miniapp-platform-alipay/skill.yaml`
  - `skill-libraries/libs/piflow_official_repo/miniapp-quality-and-compliance/skill.yaml`
- 保持 `selection.role=disabled`，先 catalog-only。
- 在 `usage.recommended_wiring` 中写明 unit 示例。

### Phase 3: 接入 PiFlow unit

- 在 `templates/skills-template.yaml` 中添加小程序 codegen/test units。
- 在 `templates/prompts-template.yaml` 中评估是否需要新增：
  - `units/codegen/miniapp.md`
  - 或 `units/codegen/miniapp-wechat.md`、`miniapp-douyin.md`、`miniapp-alipay.md`
- 优先使用 `mode: append`，不替换现有 codegen prompt。

### Phase 4: 验证与迭代

- 准备 3 类样例项目或 fixtures：
  - 微信原生小程序
  - uni-app 多平台小程序
  - Taro 多平台小程序
- 使用 PiFlow 或手动 agent 调用验证：
  - 单平台微信 unit 不加载抖音/支付宝无关规则。
  - 多平台 unit 能保持 shared 逻辑和平台 adapter 分离。
  - test unit 能输出合规、包体、权限、开发者工具验证清单。
  - Taro 样例可通过 `design-spec.yaml` 配置在 weapp/tt/alipay 三端切换编译产物。

## 8. 测试与验收

### 文档与安装验收

- 每个 skill 目录都能通过根安装器必需文件检查。
- 每个 `VERSION` 为 `0.1.0`。
- 每个 README 有中英文互链、安装命令、用途说明和 PiFlow unit 示例。
- 每个 `install.mjs` 可在 skill 目录内执行。
- 每个 `agents/openai.yaml` 与 `SKILL.md` 触发描述一致。

### 内容验收

- `miniapp-cross-platform-foundation` 不包含平台专项长篇规则，只保留通用工程地基。
- 平台专项 skill 不重复 foundation 的通用规则。
- 微信、抖音、支付宝 skill 都明确要求敏感权限按需申请、拒绝授权可降级、禁止硬编码 secret。
- `miniapp-quality-and-compliance` 能覆盖测试、包体积、性能、权限、隐私、审核材料。
- 未核验的平台规则不会被写成强制事实。
- 平台私有 API 直接调用（如 `wx/tt/my`）若未经平台 skill 说明，不应通过 quality 检查。

### PiFlow 集成验收

- `miniapp_wechat` unit 同时注入 foundation + wechat。
- `miniapp_douyin` unit 同时注入 foundation + douyin。
- `miniapp_alipay` unit 同时注入 foundation + alipay。
- `miniapp_multi` 仅在多平台目标明确时启用。
- `miniapp-release` 不在默认 deploy unit 中启用。

## 9. 风险与治理

### 平台规则时效风险

风险：微信、抖音、支付宝平台规则、审核标准、基础库和开放能力变化频繁。

治理：

- skill 中保留“核对官方文档”的高风险检查点。
- 只把稳定工程原则写成强约束。
- 日期型、政策型、费率型规则必须有来源核验后再进入 skill。

### 上下文污染风险

风险：一个 unit 同时加载所有平台规则，会导致微信项目被抖音/支付宝规则干扰。

治理：

- 默认单平台 unit 只加载 foundation + 当前平台专项。
- 多平台 unit 仅在明确目标为跨平台交付时使用。

### 发布安全风险

风险：上传、提审、发布线上版本涉及凭证、主体、类目、审核、线上用户。

治理：

- `miniapp-release` 默认 catalog-only。
- 所有 destructive 或外部平台写操作必须显式授权。
- 不在代码或文档中保存真实 appid、secret、上传 key。

### Skill 粒度膨胀风险

风险：把全部平台百科塞进一个 skill 会降低可维护性和触发准确性。

治理：

- 保持“一类能力一个 skill”。
- 长平台资料放 references，按需读取。
- 平台能力复杂后再拆 companion skill，不扩大 foundation。

## 10. 评审记录

### 第 1 轮评审

- 结论: 通过
- 发现:
  - 小程序开发适合作为 PiFlow 官方 skill 组，而不是单个大 skill。
  - `miniapp-cross-platform-foundation` 应作为底座，与 `miniapp-platform-wechat` 等平台专项 skill 同时配置到 unit。
  - 首版应覆盖微信、抖音、支付宝和质量合规；百度和发布自动化暂缓。
  - 飞书文档中的高时效规则和效率案例只能作为参考，不能原样写入官方强约束。
- 修改:
  - 新增本方案文档，明确 skill 拆分、unit wiring、文件规范、版本规范和验收标准。
