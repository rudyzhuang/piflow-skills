# add-skill-lib

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`add-skill-lib` guides agents through adding a Git-hosted skill library to the PiFlow pipeline repository. It starts from a user-provided Git URL, clones or synchronizes the repository into `skill-libraries/<library-name>/`, extracts the fields needed by PiFlow templates, registers the library, exposes discovered skills, validates the `path + locator` contract, completes `skill.yaml` metadata, updates regression self-tests, and preserves the single-copy runtime constraint.

Agent instructions are in [SKILL.md](./SKILL.md).

## Install

Run the shared installer from the repository root:

```bash
node install.mjs add-skill-lib
```

Or run the compatibility wrapper from this skill directory:

```bash
node install.mjs
```

## Use

Ask the agent:

```text
把这个 Git 地址里的 skill library 纳入 PiFlow 流水线：https://github.com/example/piflow-skills.git
```

```text
add piflow skill lib https://github.com/example/piflow-skills.git
```

```text
新增一个 skill library，clone 到 skill-libraries/acme-skills，并从仓库提取字段接入对应 stage。
```
