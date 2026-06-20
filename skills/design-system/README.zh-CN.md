# design-system

英文版文档见 [README.md](./README.md)。

`design-system` 是一个面向 PiFlow 的 Agent Skill，用于在 `design` 阶段建立项目级设计系统。它把 OpenDesign 设为内置的主参考设计系统库，并在需要时结合截图、现有产品界面、品牌气质或其他补充参考，整理成后续设计和代码生成都能复用的统一规则。

它的核心不是“直接套模板”，而是把外部参考归一化为项目自有的设计系统契约，让后续 `design` 子角色、`design-review` 和 `codegen` 都围绕同一套系统工作。

## 核心能力

- 把设计系统工作定位为 PiFlow `design` 阶段中的独立 `role`
- 默认先从 OpenDesign 选择主参考
- 在 OpenDesign 覆盖不足时允许扩展到其他来源
- 将外部参考归一化为项目自己的 token、布局原则、组件原则、交互规则和 guardrails
- 区分跨端共用规则与端别变体
- 产出既适合人看、也适合后续 Agent 消费的设计系统结果
- 避免后续页面或功能设计各自漂移成不同风格

## 安装

推荐在仓库根目录运行：

```bash
node install.mjs design-system
```

也可以在当前 skill 目录运行本地 wrapper：

```bash
node install.mjs
```

常用安装选项：

```bash
node ../install.mjs design-system --dry-run
node ../install.mjs design-system --only codex
node ../install.mjs design-system --only cursor
node ../install.mjs design-system --only claude
node ../install.mjs design-system --copy
```

## 如何使用

根据 PRD 和参考站生成项目级设计系统：

```text
使用 design-system，先从 OpenDesign 选择主参考，再根据 PRD 整理一份 PiFlow design 阶段可用的项目级设计系统。
```

让它同时设计 PiFlow 内的 role 和 unit：

```text
使用 design-system，给项目引入 design system，并补充在 PiFlow 里的 role、unit 和 review 检查点。
```

把现有产品界面整理为统一系统：

```text
使用 design-system，基于当前官网、后台和移动端截图，提炼共用的设计系统并说明哪些规则共享、哪些规则按端区分。
```

也可以直接运行内置 helper：

```bash
node skills/design-system/scripts/opendesign-design-system.mjs --slug vercel
node skills/design-system/scripts/opendesign-design-system.mjs --query "developer tool saas" --format markdown
node skills/design-system/scripts/opendesign-design-system.mjs --query fintech --output /tmp/design-system.json
```

helper 输出现在会附带 `piflow_artifact`，可直接给 PiFlow feature 级 `design.json` 的 `implementation_spec.ui_ue_spec.visual_constraints` 使用。

## 参考源策略

- OpenDesign 是这个 skill 的内置主参考设计系统库。
- 除非用户明确指定别的来源，否则 Agent 应先查 OpenDesign。
- 当 OpenDesign 对产品类型、平台模式或交互风格覆盖不足时，可以引入其他来源作为补充或扩展。
- 最终产物仍然应该是 PiFlow 项目自有的 design-system 结果，而不是外部站点本身。

## 适用输出

这个 skill 适合帮助 Agent 产出：

- 项目级设计方向摘要
- 参考站选择结论和理由
- 颜色、排版、间距、圆角、阴影等基础 token
- 布局、栅格、导航 shell、页面密度等布局原则
- 组件原则和通用状态规则
- 内容语气、CTA 风格、空状态文案原则
- 明确的视觉禁区和 guardrails
- PiFlow 下游设计角色的继承边界

## 文件说明

- `SKILL.md`：触发条件、PiFlow 中的角色定位、内置 OpenDesign 策略、工作流和评审清单
- `VERSION`：当前版本号
- `CHANGELOG.md`：版本历史
- `README.md` / `README.zh-CN.md`：中英文说明文档
- `install.mjs`：转发到仓库根安装器的兼容 wrapper
- `scripts/opendesign-design-system.mjs`：抓取并归一化 OpenDesign pack，输出 PiFlow 可用的设计系统草稿，并附带 `piflow_artifact.visual_constraints_template`
- `agents/openai.yaml`：OpenAI/Codex 展示名称和默认 prompt
