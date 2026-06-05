---
name: piflow-status-inspector
description: Query the current PiFlow project runtime status by reading output-stages/stages.json and summarizing project brief, completed stages with total runtime, failed stages with elapsed runtime, current running stage details, completed and pending subitems, failure counts, recovery counts, and other useful progress signals. Use when the user asks to 查询当前项目运行状态, 查询流水线运行状态, 刷新状态, 查看项目情况, 项目状态, 运行状态, 运行报告, 查看项目进度, 看当前跑到哪了, inspect output-stages/stages.json, check PiFlow/Pillow project status, check stage execution status, or diagnose whether the current project has started.
---

# PiFlow Status Inspector

## Purpose

Report the current project's PiFlow runtime status from `output-stages/stages.json`.
The data extraction must be done by this skill's script whenever possible.
Use agent reasoning only to choose the target directory, run the script, and briefly explain the result.

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

4. If the file exists, base the answer on the script output.
   The report should include at least:
   - 项目详情：项目 ID、名称、根目录、Git remote、Remote URL、默认分支、Remote 配置时间
   - 流水线详情：当前阶段、当前状态、最近完成阶段、当前进程 PID、当前阶段启动时间、`stages.json` 更新时间、全局日志和阶段日志
   - 阶段状态列表
   - 项目简介
   - 已完成 stage 及其总计运行时间
   - 失败 stage 及其已经运行的时间
   - 当前正在执行的 stage、已经运行时间
   - 当前 stage 的已完成子项/任务、未完成子项/任务
   - codegen 进度：已完成、运行中、待处理数量，以及运行中任务的分组、分支、worktree、agent
   - Recovery 状态：是否正在 recovery、历史 recovery 次数、最近 recovery、当前/最近修复目标、决策、续跑 stage/features
   - 恢复记录：按 stage 展示 attempt、repair target、category、decision、失败摘要、续跑范围和修复摘要
   - 失败次数
   - recovery 次数
   - Any additional useful data extracted by the script, such as total stage counts, pending stages, last update time, output paths, or raw status distribution.

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
