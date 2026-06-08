---
name: piflow-status-inspector
description: Query the current PiFlow project runtime status by reading output-stages/stages.json and reporting the required project introduction, current run progress, per-task repair/retry/runtime details, and future stages. Use when the user asks to 查询当前项目运行状态, 查询流水线运行状态, 刷新状态, 查看项目情况, 项目状态, 运行状态, 运行报告, 查看项目进度, 看当前跑到哪了, inspect output-stages/stages.json, check PiFlow/Pillow project status, check stage execution status, or diagnose whether the current project has started.
---

# PiFlow Status Inspector

## Purpose

Report the current project's PiFlow runtime status from `output-stages/stages.json`.
The data extraction must be done by this skill's script whenever possible.
Use agent reasoning only to choose the target directory, run the script, and briefly explain the result.

## Required Output Contract

When `<project-dir>/output-stages/stages.json` exists, the user-facing answer must include the script's Chinese Markdown report as the main content. Do not replace it with an ad hoc short summary.

The answer must preserve these top-level sections and fields:

1. `## 项目介绍`
   - 项目路径
   - 项目 ID
   - 项目名称
   - default agent：实际生效的默认 `agent_provider` 和大模型
   - Git 本地仓库
   - Git remote / Remote URL / 默认分支 when available

2. `## 当前运行`
   - 流水线阶段
   - 状态
   - 当前 stage 实际使用的 `agent_provider` 和大模型
   - 进度：已完成数 / 总任务数
   - 已完成任务列表
   - 运行中任务列表
   - 待处理任务列表
   - 每个任务必须展示：修复次数、重试次数、有效执行时间

3. `## Recovery`
   - 按记录列出每次修复/恢复清单
   - 每次修复必须展示耗时；缺失时显示未知

4. `## 已完成 Stages`
   - 按 PiFlow 流水线顺序列出已经完成的 stage
   - 每个 stage 必须展示：执行的累计时间、实际使用的 `agent_provider`

5. `## 后续阶段`
   - 按 PiFlow 流水线顺序列出当前 stage 之后的每个 stage
   - 每个 stage 必须展示：未开始/已执行状态，以及已执行累计时间

If the script output is long, keep these required sections intact and only trim older diagnostic sections after them. Never answer only with legacy bullets such as `当前阶段`、`当前状态`、`Codegen 已完成`、`Codegen 残留 running`、`待处理`.

## Workflow

1. Locate the target project directory.
   - Default to the current working directory.
   - If the user names a path, use that path as the project directory.
   - Do not scan unrelated parent or sibling projects unless the user asks.

2. Run the bundled parser script from this skill:

   ```bash
   node <skill-dir>/scripts/project_status.cjs --cwd <project-dir>
   ```

   Use `--json` only when another tool needs machine-readable output.

3. If `<project-dir>/output-stages/stages.json` does not exist, report:
   - `项目未开始或非 PiFlow 项目。`
   - Include the exact checked path.
   - Do not invent status from logs or unrelated files unless the user explicitly asks for deeper diagnosis.

4. If the file exists, run the script and make the script report the source of truth.
   - Do not manually reconstruct current status from `stages.json`, `ps`, logs, recovery files, or git status when the script succeeds.
   - Do not collapse the required report into a one-paragraph conclusion.
   - You may add a one-sentence conclusion before or after the report, but the required sections must remain visible.
   - If you need a shorter answer, include `## 项目介绍`, `## 当前运行`, and `## 后续阶段` first, then omit later diagnostic sections.

5. Keep the final user-facing response concise.
   - Prefer the script's Chinese Markdown report as the main source.
   - If the script reports parse errors, state the error and path.
   - Do not expose large raw JSON unless the user asks.

## Parser Expectations

The script is intentionally tolerant of evolving `stages.json` schemas. It should handle:

- top-level arrays or objects
- `stages` as an array or object map
- common stage fields such as `id`, `name`, `title`, `stage`, `status`, `state`, `startedAt`, `endedAt`, `durationMs`, `elapsedMs`, `attempts`, `failures`, `recoveryCount`
- nested task collections such as `tasks`, `items`, `steps`, `checks`, `subtasks`, `children`, or `todos`
- PiFlow metadata fields for project identity, git remote configuration, `pipeline.current`, pipeline process state, logs, codegen feature queues, worktrees, agents, `pipeline.recovery_history`, `runtime_snapshot.recovery_index`, and current recovery records when present

If the schema changes, patch the script rather than replacing it with ad hoc agent parsing.
