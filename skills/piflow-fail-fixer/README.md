# piflow-fail-fixer

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`piflow-fail-fixer` diagnoses the latest failed PiFlow run from the current project's `output-stages/stages.json`. It extracts the last failed report and related log paths, then guides the agent to identify the root cause, apply a direct fix when certain, or ask the user to choose between solution options when uncertain.

Agent instructions are in [SKILL.md](./SKILL.md).

## Install

Run the shared installer from the repository root:

```bash
node install.mjs piflow-fail-fixer
```

Or run the compatibility wrapper from this skill directory:

```bash
node install.mjs
```

## Use

Ask the agent:

```text
分析失败原因。
```

```text
分析失败并修正。
```

## Script

Core extractor:

```bash
node scripts/failure_report.cjs --cwd /path/to/project
```

JSON output:

```bash
node scripts/failure_report.cjs --cwd /path/to/project --json
```

When `output-stages/stages.json` is missing, the script reports that the project has not started or is not a PiFlow project.
