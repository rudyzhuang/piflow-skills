# piflow-fail-fixer

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`piflow-fail-fixer` is a post-failure PiFlow repair skill. It reads a project's `output-stages/stages.json`, extracts the latest failed or stopped context, expands the evidence with related logs and artifacts, and guides the agent to write a repair plan, apply a real fix, and verify it before rerun.

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
分析 PiFlow 最后一次失败，并按真实证据修复。
```

```text
分析这个项目为什么停在某个 stage，并给出修复和验证结果。
```

```text
Use $piflow-fail-fixer to diagnose the failed PiFlow run and fix it if the root cause is clear.
```

## Scripts

Failure summary:

```bash
node scripts/failure_report.cjs --cwd /path/to/project
```

Expanded repair context:

```bash
node scripts/failure_context.cjs --cwd /path/to/project
```

JSON output:

```bash
node scripts/failure_context.cjs --cwd /path/to/project --json
```

When `output-stages/stages.json` is missing, the scripts report that the project has not started or is not a PiFlow project.

## Evidence Expectations

This skill is strict about evidence:

- real logs
- real code and config
- real artifacts
- real verification results

It does not allow placeholder fixes, fake success states, skipped validation, or hidden test regressions.

## Relationship To Other Skills

- Use `piflow-fail-fixer` after failure evidence has already landed on disk.
- Use `piflow-recovery-interceptor` when a live PiFlow pipeline needs monitoring, pre-recovery interception, stop/restart orchestration, and continued watch after rerun.

## Files

- `SKILL.md`: trigger rules, hard constraints, repair workflow, and response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `scripts/failure_report.cjs`: extracts the latest failed PiFlow node.
- `scripts/failure_context.cjs`: expands failure evidence into repair context.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
