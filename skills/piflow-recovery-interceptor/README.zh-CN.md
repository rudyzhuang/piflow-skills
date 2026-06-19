# piflow-recovery-interceptor

English documentation: [README.md](./README.md).

`piflow-recovery-interceptor` 是一个面向 PiFlow 运行中监督的 skill。它负责盯住正在运行的流水线，识别 stage 异常退出或即将进入 recovery 的信号，在内部 recovery 执行前立刻停机接管，随后完成真实取证、方案治理、修复验证、流水线重启和复监控。

Agent 操作指南见 [SKILL.md](./SKILL.md)。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs piflow-recovery-interceptor
```

也可以在本 skill 目录运行兼容 wrapper：

```bash
node install.mjs
```

## 使用

安装后可以直接询问：

```text
盯住这个 PiFlow 项目；如果某个 stage 要进入 recovery，立刻拦截并接管修复。
```

```text
启动并持续监控当前流水线，修好后再重启继续看。
```

```text
监督这个 PiFlow 流水线直到真实完成，不允许伪修复。
```

## 脚本

流水线快照：

```bash
node scripts/pipeline_snapshot.cjs --cwd /path/to/project
```

Recovery 信号判断：

```bash
node scripts/recovery_signal_report.cjs --cwd /path/to/project
```

初始化修复方案骨架：

```bash
node scripts/recovery_plan_init.cjs --cwd /path/to/project --stage code-review --topic env-permission-ask
```

## 与其他 Skill 的关系

- `piflow-recovery-interceptor` 负责运行中监督、recovery 前拦截、重启编排和重启后的持续监控。
- `piflow-fail-fixer` 负责失败证据已经落盘后的事后分析与修复。

## 项目结构

```text
piflow-recovery-interceptor/
├── SKILL.md
├── README.md
├── README.zh-CN.md
├── VERSION
├── CHANGELOG.md
├── install.mjs
├── agents/
│   └── openai.yaml
└── scripts/
    ├── pipeline_snapshot.cjs
    ├── recovery_signal_report.cjs
    └── recovery_plan_init.cjs
```
