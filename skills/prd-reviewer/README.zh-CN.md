# prd-reviewer

English documentation: [README.md](./README.md).

`prd-reviewer` 是一个用于评审单个 PiFlow 分端 PRD 输出，并生成 canonical `output-stages/prd-review/prd-review-<client_target>.json` 的 Agent Skill。

它面向 PRD review 阶段，主要负责：

- 读取 `prd-spec.md`、单端 PRD JSON 和对应 feature list
- 评估范围清晰度、功能拆解、验收标准质量、边界/失败覆盖和实现就绪度
- 产出结构化的 blocking issues、recommendations、feature assessments 和 review scores
- 保持结果可以被后续 PiFlow review merge 直接消费

## 安装

在仓库根目录执行：

```bash
node install.mjs prd-reviewer
```

在当前 skill 目录执行，本地 wrapper 会转发到根安装器：

```bash
node install.mjs
```

常用安装参数：

```bash
node ../install.mjs prd-reviewer --dry-run
node ../install.mjs prd-reviewer --only codex
node ../install.mjs prd-reviewer --only cursor
node ../install.mjs prd-reviewer --only claude
node ../install.mjs prd-reviewer --copy
```

## 用法

```text
使用 prd-reviewer，评审当前端 PRD，输出 canonical 的 prd-review-<client_target>.json，不要改 PRD 正文。
```

```text
Use $prd-reviewer to review the backend PRD and write output-stages/prd-review/prd-review-backend.json with blocking issues, feature assessments, and readiness scores.
```

## 文件

- `SKILL.md`：触发条件、评审标准、输出结构和最终响应约束。
- `VERSION`：当前 skill 版本。
- `CHANGELOG.md`：版本历史。
- `README.md` / `README.zh-CN.md`：英文与中文说明。
- `install.mjs`：根安装器兼容 wrapper。
- `agents/openai.yaml`：OpenAI/Codex 展示信息与默认 prompt。
