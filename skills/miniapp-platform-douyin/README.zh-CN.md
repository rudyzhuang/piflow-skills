# miniapp-platform-douyin

中文说明: [README.md](./README.md)。

`miniapp-platform-douyin` 是抖音小程序专项能力补充 Skill，在 `miniapp-cross-platform-foundation` 后补齐 `tt` 容器差异、平台 API 边界、隐私合规与发布约束。

## 安装

在仓库根运行：

```bash
node install.mjs miniapp-platform-douyin
```

或在当前目录运行：

```bash
cd skills/miniapp-platform-douyin
node install.mjs
```

## 使用场景

- `client_target=miniapp` 且 `framework=tt` / `framework=douyin-miniapp`。
- 常与 `miniapp-cross-platform-foundation` 一起放在同一 `codegen` unit 使用。

## 工作边界

- 约束 `tt` API 的调用路径和授权时机。
- 补齐小程序发布与审核相关文档项（隐私/权限）。
- 验证路由、生命周期、存储、性能关键项。

## 与 add-skill-lib 的运行时接入

- 这是 companion skill，默认 catalog-only。
- 需要接入时先用 `add-skill-lib` 同步库与 `skill.yaml`，再按
  `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md` 落地 `piflow` 流水线 unit 规则。
