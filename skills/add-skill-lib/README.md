# add-skill-lib

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`add-skill-lib` guides agents through adding a Git-hosted skill library to the PiFlow pipeline repository with the `pif-skill-lib` CLI. It starts from a user-provided Git URL or local Git path, previews the add operation in dry-run mode, writes changes only with `--write`, registers the library in `skill-libraries/libraries.yaml`, exposes discovered skills in `templates/skills-template.yaml`, writes normalized metadata to `skill-libraries/libs/<library-name>/<skill-name>/skill.yaml`, auto-enriches every generated `skill.yaml` from local source files, adds runtime wiring guidance for stage/unit/role usage, validates the `path + locator` contract, and preserves the single-copy runtime constraint.

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

The agent should normally run:

```bash
pif-skill-lib add <git-url-or-path> --library=<name> --json
pif-skill-lib add <git-url-or-path> --library=<name> --write --json
pif-skill-lib list --json
node scripts/self-test/self-test-skill-lib-cli.cjs
```
