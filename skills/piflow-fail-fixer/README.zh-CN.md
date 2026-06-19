# piflow-fail-fixer

English documentation: [README.md](./README.md).

`piflow-fail-fixer` 是一个面向 PiFlow 失败后场景的修复 skill。它读取项目的 `output-stages/stages.json`，提取最近失败或停机的上下文，再补充关联日志、产物和 recovery 线索，指导 agent 先落修复方案，再实施真实修复，并在重跑前完成真实验证。

Agent 操作指南见 [SKILL.md](./SKILL.md)。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs piflow-fail-fixer
```

也可以在本 skill 目录运行兼容 wrapper：

```bash
node install.mjs
```

## 使用

安装后可以直接询问：

```text
分析 PiFlow 最后一次失败，并按真实证据修复。
```

```text
分析这个项目为什么停在某个 stage，并给出修复和验证结果。
```

```text
分析失败原因，先写方案，再改，再验证。
```

## 脚本

失败摘要提取：

```bash
node scripts/failure_report.cjs --cwd /path/to/project
```

扩展修复上下文：

```bash
node scripts/failure_context.cjs --cwd /path/to/project
```

输出 JSON：

```bash
node scripts/failure_context.cjs --cwd /path/to/project --json
```

如果 `output-stages/stages.json` 不存在，脚本会提示：

```text
项目未开始或非 PiFlow 项目。
```

## 证据要求

本 skill 强制要求基于以下真实证据工作：

- 真实日志
- 真实代码与配置
- 真实产物
- 真实验证结果

不允许用 placeholder、伪造成功、跳过校验、删测试或掩盖错误来“修好”流水线。

## 与其他 Skill 的关系

- `piflow-fail-fixer` 负责“失败已经落盘之后”的分析与修复。
- 如果需要监督运行中的流水线、在 recovery 前拦截、停机接管、修复后重启并继续复监控，请使用 `piflow-recovery-interceptor`。

## 项目结构

```text
piflow-fail-fixer/
├── SKILL.md
├── README.md
├── README.zh-CN.md
├── VERSION
├── CHANGELOG.md
├── install.mjs
├── agents/
│   └── openai.yaml
└── scripts/
    ├── failure_report.cjs
    └── failure_context.cjs
```
