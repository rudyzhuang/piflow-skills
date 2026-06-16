# add-skill-lib

English documentation: [README.md](./README.md).

`add-skill-lib` 用于指导 agent 将新的 skill library 纳入 PiFlow 流水线仓库。它覆盖源码落位、项目级模板登记、skill 选择模板暴露、`path + locator` 合同校验、`skill.yaml` 元数据补齐、self-test 回归，以及运行时 single-copy 约束。

Agent 操作指南见 [SKILL.md](./SKILL.md)。

## 安装

推荐在仓库根目录运行统一安装脚本：

```bash
node install.mjs add-skill-lib
```

也可以在本 skill 目录运行兼容 wrapper：

```bash
node install.mjs
```

## 使用

安装后可以直接询问：

```text
把这个新的 skill library 纳入 PiFlow 流水线。
```

```text
新增一个 skill library，并接入对应 stage。
```

## 项目结构

```text
add-skill-lib/
├── SKILL.md
├── README.md
├── README.zh-CN.md
├── VERSION
├── CHANGELOG.md
├── install.mjs
└── agents/
    └── openai.yaml
```
