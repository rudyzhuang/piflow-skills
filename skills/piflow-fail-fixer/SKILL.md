---
name: piflow-fail-fixer
description: Analyze and fix the last failed PiFlow project run by reading the current directory's output-stages/stages.json, extracting the last failed report and related logs, identifying the root cause, applying a direct fix when the cause and solution are certain, or presenting solution options for user confirmation when uncertain. Use when the user asks to 分析失败原因, 分析项目失败, 分析项目, 分析失败并修正, fix PiFlow failure, diagnose PiFlow failure, analyze project failure, inspect output-stages/stages.json failure reports, or repair a failed PiFlow/Pillow project.
---

# PiFlow Fail Fixer

## Purpose

Diagnose the latest failed PiFlow run in the current project and fix it when the root cause and repair are clear.

This skill is intentionally project-local. It must start from `<project-dir>/output-stages/stages.json`; if that file is missing, stop immediately and report:

```text
项目未开始或非 PiFlow 项目。
```

Include the exact checked path. Do not infer a PiFlow failure from unrelated files when `stages.json` is absent.

## Workflow

1. Locate the target project directory.
   - Default to the current working directory.
   - If the user names a path, use that path as the project directory.
   - Do not scan parent or sibling projects unless the user asks.

2. Run the bundled extractor:

   ```bash
   node <skill-dir>/scripts/failure_report.cjs --cwd <project-dir>
   ```

   Use `--json` when machine-readable data is useful for follow-up analysis.

3. If `stages.json` does not exist, report `项目未开始或非 PiFlow 项目。` and exit.

4. If no failed report is found, tell the user that no failed stage/report was found in `stages.json`; do not invent a failure.

5. Read only the relevant local artifacts named by the extractor:
   - report paths
   - log paths
   - output/error artifact paths
   - source files or command outputs referenced by the failed stage

6. Extract the failure signal:
   - failing stage/task name and status
   - failing command, test, build, or agent step
   - first meaningful error and last relevant stack/log section
   - affected file paths and line numbers
   - retry/recovery history if present

7. Find the root cause from code and logs before editing.
   - Prefer direct evidence from stack traces, compiler diagnostics, tests, schema validation errors, missing files, invalid paths, bad config, or deterministic command output.
   - Distinguish root cause from secondary symptoms.
   - If the extractor missed a schema variant, patch the extractor instead of ad hoc parsing.

8. Decide confidence before modifying:
   - **Certain**: The failing signal points to a concrete bug, the affected code/config is local, and the intended behavior is clear. Fix it directly.
   - **Uncertain**: Multiple plausible fixes exist, the change may alter product behavior, external credentials/services are involved, or the report lacks enough evidence. Present 2-3 concise solution options and ask the user to choose before editing.

9. When applying a fix:
   - Keep changes scoped to the root cause.
   - Preserve user changes and existing project conventions.
   - Run the narrowest verification that reproduces or covers the failure.
   - If feasible, rerun the failed command/stage or the relevant test/build command.

10. Final response:
    - State the failed stage/report that was analyzed.
    - Explain the root cause.
    - Summarize edits made, or options if awaiting confirmation.
    - Include verification performed and any command that could not run.

## Extractor Expectations

`failure_report.cjs` is tolerant of evolving `stages.json` schemas. It should find failed stages and reports from common fields such as:

- `stages`, `stageResults`, `stageRuns`, `pipeline.stages`, `execution.stages`
- `status`, `state`, `phase`, `result`
- `report`, `failureReport`, `errorReport`, `summary`, `message`, `error`, `stderr`
- `log`, `logs`, `logPath`, `logFile`, `outputPath`, `artifactPath`, `resultPath`
- nested `tasks`, `steps`, `checks`, `items`, `subtasks`, `children`, `jobs`, `actions`

If the schema changes, improve the script so future runs stay deterministic.
