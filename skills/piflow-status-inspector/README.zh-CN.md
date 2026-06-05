# piflow-status-inspector

English documentation: [README.md](./README.md).

`piflow-status-inspector` 用于查询当前 PiFlow 项目的运行状态。它默认读取当前目录下的 `output-stages/stages.json`，通过脚本解析项目简介、stage 进度、运行时间、失败次数、recovery 次数，以及当前执行 stage 的子任务完成情况。

Agent 操作指南见 [SKILL.md](./SKILL.md)。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs piflow-status-inspector
```

也可以在本 skill 目录运行兼容 wrapper：

```bash
node install.mjs
```

## 使用

安装后可以直接询问：

```text
查询当前项目运行状态。
```

```text
查询流水线运行状态，刷新状态。
```

```text
查看项目情况，给我一份运行报告。
```

```text
使用 piflow-status-inspector，看当前项目跑到哪了。
```

## 脚本

核心解析脚本：

```bash
node scripts/project_status.cjs --cwd /path/to/project
```

输出 JSON：

```bash
node scripts/project_status.cjs --cwd /path/to/project --json
```

如果 `output-stages/stages.json` 不存在，脚本会提示：

```text
项目未开始或非 PiFlow 项目。
```

## 项目结构

```text
piflow-status-inspector/
├── SKILL.md
├── README.md
├── README.zh-CN.md
├── VERSION
├── CHANGELOG.md
├── install.mjs
├── agents/
│   └── openai.yaml
└── scripts/
    └── project_status.cjs
```
