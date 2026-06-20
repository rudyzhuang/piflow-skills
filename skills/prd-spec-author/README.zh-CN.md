# prd-spec-author

English documentation: [README.md](./README.md).

`prd-spec-author` 是一个用于编写 PiFlow 共享 PRD 总源文档 `output-stages/prd/prd-spec.md` 的 Agent Skill。它会从 `output-stages/setup/canonical-req.json` 或 `inputs/req.yaml` 读取结构化需求真源，并增量补全文档。

它面向 PRD 阶段的 Agent-A 角色，重点是：

- 保留已有非空 PRD 内容
- 只补占位、缺失和明显不完整的内容
- 维持客户端目标、`feature_id`、范围/非目标、完整性覆盖和部署架构的一致性
- 为后续各端 `prd-*.json` 生成稳定的共享源文档

## 安装

在仓库根目录执行：

```bash
node install.mjs prd-spec-author
```

在当前 skill 目录执行，本地 wrapper 会转发到根安装器：

```bash
node install.mjs
```

常用安装参数：

```bash
node ../install.mjs prd-spec-author --dry-run
node ../install.mjs prd-spec-author --only codex
node ../install.mjs prd-spec-author --only cursor
node ../install.mjs prd-spec-author --only claude
node ../install.mjs prd-spec-author --copy
```

## 用法

```text
使用 prd-spec-author，根据 canonical req 增量补全 output-stages/prd/prd-spec.md，保留已有非空内容。
```

```text
Use $prd-spec-author to regenerate output-stages/prd/prd-spec.md from inputs/req.yaml without overwriting existing non-empty sections.
```

## 文件

- `SKILL.md`：触发条件、编辑边界、PRD 撰写规则和输出约束。
- `VERSION`：当前 skill 版本。
- `CHANGELOG.md`：版本历史。
- `README.md` / `README.zh-CN.md`：英文与中文说明。
- `install.mjs`：根安装器兼容 wrapper。
- `agents/openai.yaml`：OpenAI/Codex 展示信息与默认 prompt。
