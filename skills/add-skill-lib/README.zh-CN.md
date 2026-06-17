# add-skill-lib

English documentation: [README.md](./README.md).

`add-skill-lib` 用于指导 agent 通过 `pif-skill-lib` CLI 将 Git 托管的 skill library 纳入 PiFlow 流水线仓库。它从用户提供的 Git 地址或本地 Git 路径开始，先 dry-run 预览，只在显式 `--write` 后写入，完成 `skill-libraries/libraries.yaml` 登记、`templates/skills-template.yaml` catalog 暴露、`skill-libraries/libs/<library-name>/<skill-name>/skill.yaml` 规范化元数据生成，并基于本地源文件自动补全每个生成的 `skill.yaml` 治理字段和 stage/unit/role 运行时接入建议，再进行 `path + locator` 合同校验和运行时 single-copy 约束。

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
新增一个 skill library，clone 到 skill-libraries/repos/acme-skills，并把 skill.yaml 写到 skill-libraries/libs/acme-skills。
```

agent 通常应执行：

```bash
pif-skill-lib add <git-url-or-path> --library=<name> --json
pif-skill-lib add <git-url-or-path> --library=<name> --write --json
pif-skill-lib list --json
node scripts/self-test/self-test-skill-lib-cli.cjs
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
