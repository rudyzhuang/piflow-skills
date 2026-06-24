# miniapp-platform-wechat

Chinese documentation: [README.md](./README.md).

`miniapp-platform-wechat` 是微信小程序专项能力补充 Skill，用于在 `miniapp-cross-platform-foundation` 之后补齐微信原生规则和审核前检查。

## 安装

在仓库根运行：

```bash
node install.mjs miniapp-platform-wechat
```

或在当前目录运行：

```bash
cd skills/miniapp-platform-wechat
node install.mjs
```

## 使用场景

- `client_target=miniapp && framework=wechat-miniapp`
- 与 `miniapp-cross-platform-foundation` 同时启用。

## 工作边界

- 约束 `wx` API 的调用路径和授权时机。
- 生成隐私和审核相关说明项。
- 保障页面、导航、性能边界检查。

## 与 add-skill-lib 的运行时接入

- 这是 companion skill，默认 catalog-only，不会自行改动 `piflow` runtime。
- 需要接入时先用 `add-skill-lib` 同步库与 `skill.yaml`，再按
  `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md` 完成单元/模板启用。
