# add-skill-lib

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`add-skill-lib` guides agents through adding a Git-hosted skill library to the PiFlow pipeline repository. It starts from a user-provided Git URL, clones or synchronizes the repository into `skill-libraries/repos/<library-name>/`, extracts fields for `skill-libraries/libraries.yaml` and `templates/skills-template.yaml`, writes normalized metadata to `skill-libraries/libs/<library-name>/<skill-name>/skill.yaml`, registers the library, exposes discovered skills, validates the `path + locator` contract, updates regression self-tests, and preserves the single-copy runtime constraint.

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
新增一个 skill library，clone 到 skill-libraries/repos/acme-skills，并把 skill.yaml 写到 skill-libraries/libs/acme-skills。
```
