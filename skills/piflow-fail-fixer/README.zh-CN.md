# piflow-fail-fixer

English documentation: [README.md](./README.md).

`piflow-fail-fixer` 用于分析并修复当前 PiFlow 项目的最后一次失败。它默认读取当前目录下的 `output-stages/stages.json`，提取最后失败的报告和相关日志路径，然后指导 agent 分析根因：如果问题和解决方案很确定就直接修改；如果不确定，则形成方案选项让用户确认后再落地执行。

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
分析失败原因。
```

```text
分析项目失败。
```

```text
分析项目。
```

```text
分析失败并修正。
```

## 脚本

核心失败报告提取脚本：

```bash
node scripts/failure_report.cjs --cwd /path/to/project
```

输出 JSON：

```bash
node scripts/failure_report.cjs --cwd /path/to/project --json
```

如果 `output-stages/stages.json` 不存在，脚本会提示：

```text
项目未开始或非 PiFlow 项目。
```

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
    └── failure_report.cjs
```
