# miniapp-quality-and-compliance

中文说明: [README.md](./README.md)。

`miniapp-quality-and-compliance` 是小程序交付后的质量与合规覆盖技能（平台边界、权限、隐私、发布就绪性）。

## 安装

在仓库根运行：

```bash
node install.mjs miniapp-quality-and-compliance
```

或在当前目录运行：

```bash
cd skills/miniapp-quality-and-compliance
node install.mjs
```

## 使用场景

- `client_target=miniapp`，用于 `codegen` 补齐或 `test` 阶段合规检查。
- 与 `miniapp-cross-platform-foundation`、`miniapp-platform-*` 联动使用。

## 工作边界

- 检查平台边界隔离是否到位（不要把平台 API 泄漏到公共逻辑）。
- 检查隐私、权限、审核前置文案/异常文案是否完整。
- 对阻塞项输出 `needs_human` 或明确阻断清单。

## 与 add-skill-lib 的运行时接入

- 这是测试/合规 companion skill，默认 catalog-only。
- 需要接入时先用 `add-skill-lib` 同步库与 `skill.yaml`，再按
  `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md` 落地 `test` 阶段 unit 组合。
