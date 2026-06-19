# piflow-recovery-interceptor

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`piflow-recovery-interceptor` is a live PiFlow supervision skill. It watches a running pipeline, detects abnormal exits or pre-recovery signals, stops the pipeline before internal recovery executes, collects real evidence, governs a repair plan, verifies the real fix, restarts the pipeline, and keeps monitoring after restart.

Agent instructions are in [SKILL.md](./SKILL.md).

## Install

Run the shared installer from the repository root:

```bash
node install.mjs piflow-recovery-interceptor
```

Or run the compatibility wrapper from this skill directory:

```bash
node install.mjs
```

## Use

Ask the agent:

```text
Use $piflow-recovery-interceptor to supervise this PiFlow run until it truly completes.
```

```text
盯住这个 PiFlow 项目；如果某个 stage 要进入 recovery，立刻拦截并接管修复。
```

```text
启动并持续监控当前流水线，修好后再重启继续看。
```

## Scripts

Pipeline snapshot:

```bash
node scripts/pipeline_snapshot.cjs --cwd /path/to/project
```

Recovery signal report:

```bash
node scripts/recovery_signal_report.cjs --cwd /path/to/project
```

Initialize a repair plan skeleton:

```bash
node scripts/recovery_plan_init.cjs --cwd /path/to/project --stage code-review --topic env-permission-ask
```

## Relationship To Other Skills

- Use `piflow-recovery-interceptor` for live supervision, recovery interception, restart orchestration, and continued monitoring.
- Use `piflow-fail-fixer` when failure evidence is already on disk and you only need post-failure diagnosis and repair.

## Files

- `SKILL.md`: monitoring rules, interception workflow, repair governance, and response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `scripts/pipeline_snapshot.cjs`: summarize the current PiFlow runtime state.
- `scripts/recovery_signal_report.cjs`: detect signals that suggest recovery interception is needed.
- `scripts/recovery_plan_init.cjs`: create a repair-plan markdown skeleton.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
