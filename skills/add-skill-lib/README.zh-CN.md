# add-skill-lib

English documentation: [README.md](./README.md).

`add-skill-lib` 用于指导 agent 将 Git 托管的 skill library 纳入 PiFlow 流水线仓库。它从用户提供的 Git 地址开始，自动 clone 或同步到 `skill-libraries/<library-name>/`，从仓库中提取 PiFlow 模板所需字段，完成 library 登记、skill 暴露、`path + locator` 合同校验、`skill.yaml` 元数据补齐、self-test 回归，以及运行时 single-copy 约束。

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
把这个 Git 地址里的 skill library 纳入 PiFlow 流水线：https://github.com/example/piflow-skills.git
```

```text
增加piflow技能库 https://github.com/example/piflow-skills.git
```

```text
新增一个 skill library，clone 到 skill-libraries/acme-skills，并从仓库提取字段接入对应 stage。
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
