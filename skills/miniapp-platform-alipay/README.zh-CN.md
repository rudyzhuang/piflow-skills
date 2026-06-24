# miniapp-platform-alipay

中文说明: [README.md](./README.md)。

`miniapp-platform-alipay` 是支付宝小程序专项能力补充 Skill，在 `miniapp-cross-platform-foundation` 后补齐支付链路、权限边界和发布审核约束。

## 安装

在仓库根运行：

```bash
node install.mjs miniapp-platform-alipay
```

或在当前目录运行：

```bash
cd skills/miniapp-platform-alipay
node install.mjs
```

## 使用场景

- `client_target=miniapp` 且 `framework=alipay` / `framework=alipay-miniapp`。
- 常与 `miniapp-cross-platform-foundation` 同时启用。

## 工作边界

- 约束 `my` API 的调用路径。
- 对支付、授权、用户信息读取路径保持最小权限与明确异常处理。
- 明确审核/隐私相关的用户提示与文案约束。

## 与 add-skill-lib 的运行时接入

- 这是 companion skill，默认 catalog-only。
- 需要接入时先用 `add-skill-lib` 同步库与 `skill.yaml`，再按
  `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md` 落地 `templates/skills-template.yaml` 启用策略。
