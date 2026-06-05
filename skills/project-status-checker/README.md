# project-status-checker

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`project-status-checker` reports the current PiFlow project runtime status. It reads `output-stages/stages.json` from the target project directory and uses a bundled script to summarize the project brief, stage progress, runtime, failures, recovery counts, and the running stage's nested task status.

Agent instructions are in [SKILL.md](./SKILL.md).

## Install

Run the shared installer from the repository root:

```bash
node install.mjs project-status-checker
```

Or run the compatibility wrapper from this skill directory:

```bash
node install.mjs
```

## Use

Ask the agent:

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
Use $project-status-checker to check where the current project is.
```

## Script

Core parser:

```bash
node scripts/project_status.cjs --cwd /path/to/project
```

JSON output:

```bash
node scripts/project_status.cjs --cwd /path/to/project --json
```

When `output-stages/stages.json` is missing, the script reports that the project has not started or is not a PiFlow project.
