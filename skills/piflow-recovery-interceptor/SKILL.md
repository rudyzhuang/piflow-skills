---
name: piflow-recovery-interceptor
description: Use when supervising a live PiFlow pipeline that may fail, hang, or enter internal recovery, and the agent must intercept before recovery, collect real evidence, govern a repair plan, verify a real fix, restart the pipeline, and continue monitoring.
---

# PiFlow Recovery Interceptor

## Mission

Supervise a live PiFlow pipeline as an external guardian and drive it to real, complete, and stable completion.

This skill owns the live loop:

- watch the running pipeline
- detect failure or pre-recovery signals
- stop the pipeline before internal recovery executes
- collect evidence
- govern the repair plan
- verify the real fix
- restart the pipeline
- continue monitoring after restart

If the pipeline has already stopped and only post-failure diagnosis is needed, `piflow-fail-fixer` is usually enough.

## Hard Rules

- Use real logs, real code, real config, real artifacts, and real verification only.
- If a stage exits abnormally and is about to enter recovery, stop the pipeline immediately. Do not wait for recovery to execute.
- Write a repair plan before editing.
- Do not use placeholder, stub, mock, fake, dummy, in-memory fallback, skipped auth, skipped tests, deleted tests, lowered validation, masked errors, or hard-coded success.
- Only restart the pipeline after verification passes.
- If the same class of problem repeats, do not apply a one-off patch blindly; re-analyze the shared root cause.

## Startup And Takeover

1. Identify the target project directory.
   - Default to the current working directory.
   - If the user names a project path, use it directly.

2. If the pipeline is not already running, start it:

   ```bash
   pif 2>&1 | tee ./codex-task.log
   ```

3. If the pipeline is already running or resumable, do not start a duplicate session. Take over the existing run instead.

4. On takeover, confirm:
   - current stage
   - current state
   - latest failure or anomaly
   - whether recovery seems imminent
   - log locations
   - output directories
   - agent input/output artifacts
   - live process PID or session id

## Monitoring Loop

Continuously watch:

- stage progress
- agent input/output
- error logs
- artifact changes
- recovery trigger signals
- post-restart execution results

Pay special attention to:

- stage abnormal exit
- pending or imminent recovery
- build failure
- test failure
- agent timeout, hang, or execution failure
- real-chain issues in config, dependency, runtime, auth, persistence, adapter, or environment
- signs of fake fixes or weakened validation

Use the bundled scripts when useful:

```bash
node <skill-dir>/scripts/pipeline_snapshot.cjs --cwd <project-dir>
node <skill-dir>/scripts/recovery_signal_report.cjs --cwd <project-dir>
```

## Recovery Interception Rule

When you detect both of these conditions:

- a stage exited abnormally or is clearly failing
- the pipeline is about to enter internal recovery

You must:

1. Stop the pipeline immediately.

   ```bash
   pif-stop --project=<project-dir> --reason="<short evidence-based reason>"
   ```

2. Preserve:
   - current logs
   - stage state
   - agent input/output
   - relevant artifacts
   - recovery sidecars or stop signals

3. Switch into the external repair workflow below.

## External Repair Workflow

1. Collect evidence.
   - failed stage
   - error logs and stack traces
   - relevant code and config
   - test output
   - artifact state
   - agent input/output

2. Analyze root cause.
   - determine whether the issue belongs to:
     - project code
     - tests
     - config
     - dependency
     - environment
     - agent execution
     - PiFlow mechanism
     - transient external issue

3. Write the repair plan.
   - save to `.codex/recovery-intercept/` or `.codex/<stage-name>/`
   - include:
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
     - restart strategy

4. Execute the repair.
   - fix the real cause, not the superficial symptom

5. Run real verification.
   - use real commands with meaningful coverage
   - do not skip or weaken checks

6. Restart the pipeline only after verification passes.

   ```bash
   pif 2>&1 | tee ./codex-task.log
   ```

7. Continue monitoring the original failed stage and downstream stages.

## Repeated-Issue Rule

If the same type of problem appears again:

- do not stack another one-off patch blindly
- analyze the common root cause
- prioritize checking:
  - agent inputs
  - pipeline mechanism
  - context selection
  - verification strategy
  - termination conditions

## Round Output Contract

After each monitoring, interception, repair, validation, or restart cycle, report:

- current stage and state
- whether a stage abnormal exit occurred
- whether recovery was intercepted
- key log evidence
- root cause judgment
- ownership
- repair plan path
- change summary
- verification commands and results
- whether the pipeline was restarted
- next monitoring focus

## Completion And Stop Conditions

The supervision loop ends only when one of these is true:

- the pipeline truly completes and no high-risk unresolved issue or fake-fix signal remains
- or the current blocker cannot be safely auto-repaired, and you report:
  - root cause
  - ownership
  - risk
  - completed verification
  - recommended manual next step
