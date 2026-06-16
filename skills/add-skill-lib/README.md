# add-skill-lib

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`add-skill-lib` guides agents through adding a new skill library to the PiFlow pipeline repository. It covers source placement under `skill-libraries/`, project-level template registration, skill exposure in `skills-template.yaml`, `path + locator` validation, `skill.yaml` metadata, regression self-tests, and the single-copy runtime constraint.

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
把这个新的 skill library 纳入 PiFlow 流水线。
```

```text
新增一个 skill library，并接入对应 stage。
```
