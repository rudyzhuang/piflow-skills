# miniapp-cross-platform-foundation

Chinese documentation: [README.md](./README.md).

`miniapp-cross-platform-foundation` 是 PiFlow 的小程序跨平台底座 skill（Taro-first）。
它用于统一小程序基础结构、平台能力适配边界和跨端质量前置约束，随后由对应平台 skill 继续补齐细节。

## 安装

在仓库根运行：

```bash
node install.mjs miniapp-cross-platform-foundation
```

或在本目录运行兼容安装脚本：

```bash
node install.mjs
```

## 使用

适用场景（与 platform skill 组合）：

- `client_target=miniapp && framework=taro/uni-app`
- `client_target=miniapp && framework=wechat-miniapp`
- `client_target=miniapp && framework=douyin-miniapp`
- `client_target=miniapp && framework=alipay-miniapp`

## 职责范围

要做：

- 统一 `src/pages`、`src/components`、`src/utils`、`src/platform` 等基础目录
- 统一 API 封装与环境变量
- 建立条件编译和平台适配边界
- 为后续平台专项 skill 提供稳定上下文

不做：

- 自动上架/提审/发布到平台
- 平台高风险审核策略的最终决策

## 与 add-skill-lib 的运行时接入约定

- 该 skill 默认是 catalog-only，不会自动改动 `piflow` 真实 runtime 配置。
- 需要接入流水线时：
  1. 先用 `add-skill-lib` 同步技能库并生成 `skill.yaml`；
  2. 再按 `references/piflow-runtime-integration.md` 补齐 `templates/skills-template.yaml` 中的 unit 组合。
- 未明确授权前，不要把该 skill 作为默认启用项落库。

## 引用参考

- `references/taro-stack.md`
- `references/framework-detection.md`
- `references/project-structure.md`
- `references/platform-adapters.md`
- `references/design-spec-contract.md`
- `references/conditional-compilation.md`
