# prd-client-author

English documentation: [README.md](./README.md).

`prd-client-author` 是一个用于生成单个 PiFlow 分端 PRD JSON 的 Agent Skill，例如 `prd-website.json`、`prd-admin.json`、`prd-backend.json`、`prd-mobile.json`，并同步维护对应的 `feature_list-<client_target>.md`。

它面向 PRD 阶段的 Agent-B 角色，主要负责：

- 读取共享总源 `output-stages/prd/prd-spec.md`
- 只处理一个 `client_target`
- 保留当前端已有非空字段
- 补齐当前端的功能、范围、完整性和契约字段
- 保持 `feature_id` 与共享 PRD 总源一致

## 安装

在仓库根目录执行：

```bash
node install.mjs prd-client-author
```

在当前 skill 目录执行，本地 wrapper 会转发到根安装器：

```bash
node install.mjs
```

常用安装参数：

```bash
node ../install.mjs prd-client-author --dry-run
node ../install.mjs prd-client-author --only codex
node ../install.mjs prd-client-author --only cursor
node ../install.mjs prd-client-author --only claude
node ../install.mjs prd-client-author --copy
```

## 用法

```text
使用 prd-client-author，只补全当前端的 prd-*.json 和 feature_list，不要改别的端。
```

```text
Use $prd-client-author to update output-stages/prd/prd-backend.json for the backend target and refresh feature_list-backend.md.
```

## 文件

- `SKILL.md`：触发条件、分端撰写规则和输出约束。
- `VERSION`：当前 skill 版本。
- `CHANGELOG.md`：版本历史。
- `README.md` / `README.zh-CN.md`：英文与中文说明。
- `install.mjs`：根安装器兼容 wrapper。
- `agents/openai.yaml`：OpenAI/Codex 展示信息与默认 prompt。
