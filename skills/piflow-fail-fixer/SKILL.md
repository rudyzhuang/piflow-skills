---
name: piflow-fail-fixer
description: Use when a PiFlow project has already failed or stopped with a concrete failure signal and the agent must analyze root cause from real evidence, prepare a repair plan, apply a real fix, and verify it before rerun.
---

# PiFlow Fail Fixer

## Purpose

Diagnose and repair a failed PiFlow run from real evidence that already exists on disk.

This skill is for post-failure analysis and repair. It does not own live pipeline supervision or recovery interception. If the user needs monitoring, pre-recovery interception, stop/restart orchestration, or continued watch after rerun, use `piflow-recovery-interceptor`.

## Hard Rules

- Use real logs, real code, real config, real artifacts, and real verification results only.
- Analyze root cause before editing.
- Write the repair plan to `.codex/recovery-intercept/` or `.codex/<stage-name>/` before applying the fix.
- Do not use placeholder, stub, mock, fake, dummy, in-memory fallback, skipped auth, skipped tests, deleted tests, lowered validation, masked errors, or hard-coded success.
- If a test double is truly necessary, it must stay inside the test boundary and must not replace the real production path.
- Do not claim success without running real verification commands and reporting the results.

## When To Use

Use this skill when one of these is true:

- `output-stages/stages.json` already records a failed, stopped, blocked, or crashed stage
- the pipeline was externally stopped after failure evidence had already landed on disk
- the user asks to analyze a PiFlow failure, inspect the last failed report, or fix a failed PiFlow project
- a recovery interception already happened and you now need evidence-driven repair work

Do not use this skill as the primary workflow for a still-running pipeline that needs active monitoring and pre-recovery interception.

## Workflow

1. Locate the target project directory.
   - Default to the current working directory.
   - If the user names a path, use that path.
   - Do not scan parent or sibling projects unless asked.

2. Confirm the project is a PiFlow project.
   - Check `<project-dir>/output-stages/stages.json`.
   - If missing, stop and report:

   ```text
   项目未开始或非 PiFlow 项目。
   ```

   Include the exact checked path.

3. Extract the failed node summary.
   - Run:

   ```bash
   node <skill-dir>/scripts/failure_report.cjs --cwd <project-dir>
   ```

   - Use `--json` when the follow-up analysis needs machine-readable fields.

4. Expand the failure into repair context.
   - Run:

   ```bash
   node <skill-dir>/scripts/failure_context.cjs --cwd <project-dir>
   ```

   - Read only the relevant artifacts named by the extractor and context script:
     - failed stage or task report
     - stage log and global log
     - recovery sidecars when present
     - agent input/output or stage artifacts when relevant
     - code/config/test files directly implicated by the evidence

5. Identify the failure signal.
   - Capture:
     - failed stage or task
     - stage status and exit code
     - first meaningful error
     - last relevant stack/log section
     - affected file paths and line numbers
     - retry or recovery history when present

6. Find the root cause before editing.
   - Prefer direct evidence from stack traces, compiler diagnostics, tests, schema validation, missing files, invalid paths, dependency mismatches, config errors, or deterministic command output.
   - Distinguish root cause from secondary symptoms.
   - Classify the ownership:
     - project code
     - tests
     - config
     - dependency
     - environment
     - agent execution
     - PiFlow mechanism
     - transient external issue

7. Decide confidence before modifying.
   - **Certain**: the evidence points to a concrete local defect and the intended behavior is clear. Fix it directly.
   - **Uncertain**: multiple plausible fixes exist, user-facing behavior would change, external credentials/services are involved, or the evidence is insufficient. Present 2-3 concise options and ask for confirmation before editing.

8. Write the repair plan.
   - Save it under `.codex/recovery-intercept/` or `.codex/<stage-name>/`.
   - The plan must include:
     - problem symptom
     - key evidence
     - root cause analysis
     - ownership
     - impact scope
     - repair target
     - anti-fake-fix statement
     - concrete modification points
     - verification commands
     - expected improvement
     - risk controls
     - rerun or restart strategy

9. Apply the fix.
   - Keep changes scoped to the root cause.
   - Preserve user changes and project conventions.
   - Prefer fixing the real contract or mechanism over hiding the symptom.

10. Run real verification.
   - Run the narrowest real command that reproduces or covers the failure.
   - If feasible, rerun the failed stage, failed command, or relevant test/build/check.
   - Report both successful and unavailable verification steps honestly.

11. Final response.
   - State which failed stage or report was analyzed.
   - Explain the root cause and ownership.
   - Summarize the edits made, or the options if awaiting confirmation.
   - Include verification commands and results.
   - State whether the project is ready to rerun, and from which stage if known.

## Output Contract

Each repair pass should report:

- analyzed stage and status
- key evidence
- root cause judgment
- ownership
- repair plan path
- change summary
- verification commands and results
- rerun recommendation
