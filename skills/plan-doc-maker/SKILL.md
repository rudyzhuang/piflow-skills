---
name: plan-doc-maker
description: Generate Chinese proposal, solution, architecture, implementation, migration, refactor, or upgrade plan documents under project-local docs/plans/, and maintain a reviewed docs/plans/last_plan.md execution index. Use when the user asks to 写方案, 生成方案, 形成方案, 给出方案, create, draft, review, refine, merge, consolidate, or finalize a 方案文档, 技术方案, 实施方案, 改造方案, 升级方案, 迁移方案, 架构方案, last_plan.md, or project plan, especially when the plan must be reviewed against the current repository before being marked reviewed and committed or pushed.
---

# Plan Doc Maker

## Overview

Create project-local plan documents in `docs/plans/`, maintain each target project's `docs/plans/last_plan.md` as the deduplicated and reviewed execution index, then run mandatory review-and-revision loops until the plan set is reasonable, complete, internally consistent, and compatible with the current project contracts. Write in Chinese unless the user asks for another language.

## Workflow

1. Locate and validate the target project root or roots. This is the highest-priority gate.
   - If the user explicitly provides an output path for the generated plan document, treat it as a requested candidate path, infer its project root from the nearest containing git repository, and still validate that the path matches the actual target project before writing or updating it.
   - If the user does not provide an output path, first determine which project the plan modifies or implements from the request, current directory, git repository boundaries, mentioned files, package or service names, workspace layout, and nearby project metadata.
   - Treat "which project is being modified or implemented" as more important than "where the source evidence came from" or "where the current file happens to live".
   - Runtime artifacts, logs, screenshots, output directories, `.pipeline/`, `output-stages/`, issue samples, failing app worktrees, and copied snippets are evidence sources. They do not by themselves make their containing project the target project.
   - If a plan uses one project as an example but proposes changes to another project's framework, skill, pipeline, CLI, generator, review rule, deployment system, or shared tooling, the target project is the tool/framework project, not the sample project.
   - If an existing plan document is being reviewed or consolidated, verify that the document path is under the actual target project's `docs/plans/` before reviewing content, maintaining `last_plan.md`, or changing statuses.
   - If the document path and actual target project do not match, stop the normal review/consolidation flow for that path. Report the path mismatch first, recommend or perform the move only if requested, and do not create, update, review, commit, or push `last_plan.md` in the wrong project.
   - Example: a plan stored under `piflow-online/docs/plans/` that uses `piflow-online/output-stages` as failure evidence but proposes changes to `piflow` codegen, code-review, watchdog, recovery, artifact schemas, or deterministic checks belongs under `piflow/docs/plans/`.
   - If the request spans multiple projects, split the work by project. Generate and maintain a separate plan document and `last_plan.md` under each project's own `<project-root>/docs/plans/`.
   - Prefer explicit project paths or named projects over the current git repository root.
   - If the target project remains ambiguous after inspecting local context, proceed with the most likely project root and record the assumption in the document instead of blocking, unless writing to the wrong project would be unsafe.
   - If no git repository exists, use the current workspace root.

2. Gather context.
   - Read the user's request and any provided files, notes, issues, screenshots, existing plans, requirements, or design docs.
   - Inspect the current project before proposing changes. Prefer targeted reads of files that define contracts and architecture, such as `README*`, `docs/`, `package.json`, `pyproject.toml`, API route definitions, schemas, migrations, config files, tests, types, interfaces, and existing conventions.
   - If the plan modifies or upgrades an existing project, identify relevant compatibility surfaces: public APIs, CLI commands, file formats, database schema, environment variables, authentication, permissions, deployment behavior, tests, and migration paths.
   - If important context is unavailable, continue with explicit assumptions instead of blocking unless the missing fact would make the plan unsafe.

3. Choose and validate the output path for each target project.
   - Create `<project-root>/docs/plans/` if needed.
   - Use local time for the file prefix, formatted as `<yyyymmdd-HHmm>`.
   - Generate a short ASCII lowercase slug for the main proposal purpose, such as `auth-upgrade`, `api-refactor`, `billing-migration`, or `plan-doc-maker`.
   - Write to `<project-root>/docs/plans/<yyyymmdd-HHmm>-<proposal>.md`.
   - If the target file already exists, append a short disambiguator such as `-v2`.
   - When multiple projects are involved, choose a slug that is meaningful within each project and do not put all project plans into a single shared `docs/plans/` directory unless the user explicitly provided such a path.
   - Before writing or updating any file, re-check that the chosen output path is inside the actual target project's `docs/plans/`.

4. Draft the first version.
   - Load this skill's bundled template from `assets/plan-template.md` and use it as the default starting structure.
   - Start with the template's metadata block, then its Markdown table of contents, then the plan body.
   - Replace every placeholder with concrete content, remove instructional placeholder text, and add or remove sections only when the user's requested plan calls for it.
   - Use concrete, executable planning language. Avoid vague recommendations that cannot guide implementation.
   - When planning changes to an existing codebase, tie recommendations back to observed files, modules, contracts, and compatibility constraints.

5. Review each newly generated project plan.
   - Review the document against the user's request and the project context.
   - Check reasonableness, completeness, internal consistency, feasibility, scope control, risks, rollback, testability, and acceptance criteria.
   - For existing-project modifications or upgrades, place extra weight on contract consistency and compatibility with the current codebase.
   - Produce concrete findings internally and apply fixes directly to the plan document. Do not leave a separate review report unless the user asks for one.

6. Repeat review and revision until each generated project plan is approved.
   - After every revision, run another review.
   - Continue while there are material omissions, contradictions, unreasonable steps, unhandled risks, incompatible assumptions, or gaps against project contracts.
   - Stop only when the review passes.
   - When the review passes, update the document status to `已评审` and refresh the modified time.

7. Maintain `last_plan.md` for each target project after generating or updating project plans.
   - Work in that project's `<project-root>/docs/plans/` directory.
   - After the project plan document has been generated or updated and reviewed, check for `<project-root>/docs/plans/last_plan.md`.
   - If the user asks only to maintain, review, or consolidate existing plans without creating a new plan, still run this step for the target project.
   - If `last_plan.md` does not exist, read every Markdown file in the directory one by one except `last_plan.md` itself. Do not rely only on filenames or summaries.
   - If `last_plan.md` already exists, read it first, extract its referenced source document list, then read every Markdown file in the directory that has not yet been integrated. Also re-read any referenced source document whose path still exists if a status or contradiction cannot be resolved from `last_plan.md` alone.
   - Integrate content by modification point, not by source document. A modification point is a distinct proposed change, implementation step, migration, interface change, operational change, or verification obligation.
   - Deduplicate semantically equivalent modification points across source documents. Preserve references to every source document that contributed to the merged point.
   - Resolve contradictions and inconsistencies in the integrated content. Prefer the newest reviewed source when documents conflict, unless project contracts show that an older source is safer or the newer source is incomplete. Record the resolution and source references in the modification point.
   - Keep original plan documents unchanged. `last_plan.md` must cite them instead of replacing them.
   - Add newly integrated modification points with `活跃状态: 活跃`, `评审状态: 待评审`, and `执行状态: 未执行` unless the source and local evidence prove a different state.
   - Update existing modification points without erasing their review or execution history. If a newly integrated source materially changes an existing point, set that point back to `评审状态: 待评审` and keep the execution status accurate.

8. Review `last_plan.md` after every maintenance pass.
   - Run the same review-and-revision loop on `last_plan.md`: review, apply fixes, review again, and repeat until it passes.
   - The `last_plan.md` review must additionally check source coverage, deduplication quality, contradiction resolution, per-point status consistency, and whether all newly integrated Markdown files are referenced.
   - When review finds a modification point incomplete, contradictory, unsafe, or untestable, mark that point `评审状态: 需修订`, apply the required fix, and review again.
   - When the review pass validates an active modification point, mark that point `评审状态: 已评审`.
   - Stop only when the review passes. Then recompute the overall `文档状态`, `评审状态`, and `执行状态` from the per-point statuses, and update `last_plan.md` metadata and review record to reflect the completed review count and latest modification time.

9. Verify and finalize.
   - Confirm the actual target project root was identified before any document path, content, `last_plan.md`, or status checks were accepted.
   - Confirm each generated or reviewed plan file is under the actual target project's `docs/plans/`, not merely under the project that supplied evidence or runtime artifacts.
   - Confirm each generated plan file exists under its target project's `docs/plans/`.
   - Confirm generated plan filenames follow `<yyyymmdd-HHmm>-<proposal>.md`.
   - Confirm each target project's `docs/plans/last_plan.md` exists after the run.
   - Confirm every Markdown file in each target `docs/plans/` directory, except `last_plan.md`, is either referenced from `last_plan.md` or explicitly listed as intentionally excluded with a reason.
   - Confirm metadata blocks, table of contents, plan sections, review notes or review summaries, and final reviewed status fields are present.
   - Confirm no template placeholders such as `<方案标题>`, `<YYYY-MM-DD HH:mm>`, or instructional placeholder text remain in final documents.
   - If the local project is a git repository, commit generated or updated plan documents and `last_plan.md`.
   - If a remote for the current branch is configured and reachable, push the commit. If there is no remote, no upstream, or push is unsafe, leave the commit local and report why.

## Document Structure

Use the bundled template at `assets/plan-template.md` by default. Add or remove sections when the user's requested plan calls for it, but keep the metadata block and table of contents.

```markdown
---
title: <方案标题>
版本: 1.0.0
文档状态: 草稿
代码实现: 未执行
实现文档版本: 无
创建时间: <YYYY-MM-DD HH:mm>
修改时间: <YYYY-MM-DD HH:mm>
作者: Codex
评审轮次: 0
评审结果: 待评审
来源上下文:
  - <用户请求或关键输入>
  - <项目内参考文件>
---

# <方案标题>

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 当前状态与约束](#2-当前状态与约束)
- [3. 方案概述](#3-方案概述)
- [4. 详细设计](#4-详细设计)
- [5. 实施计划](#5-实施计划)
- [6. 兼容性与迁移](#6-兼容性与迁移)
- [7. 测试与验收](#7-测试与验收)
- [8. 风险与回滚](#8-风险与回滚)
- [9. 评审记录](#9-评审记录)

## 1. 背景与目标

## 2. 当前状态与约束

## 3. 方案概述

## 4. 详细设计

## 5. 实施计划

## 6. 兼容性与迁移

## 7. 测试与验收

## 8. 风险与回滚

## 9. 评审记录
```

## Metadata Rules

- `文档状态` starts as `草稿`.
- Valid statuses include `草稿`, `评审中`, `已评审`, `已执行`, `已废弃`, and `需修订`.
- `代码实现` records whether implementation has been performed. Valid values include `未执行`, `部分执行`, and `已执行`.
- `实现文档版本` records the plan document version that the implementation followed. Use `无` when `代码实现: 未执行`; use the concrete plan version such as `1.0.0` when implementation is partial or complete.
- `创建时间` is the initial local timestamp and must not change after creation.
- `修改时间` is refreshed whenever the document is materially revised.
- `评审轮次` records the number of completed review passes.
- `评审结果` is `待评审`, `需修订`, or `通过`.
- When the final review passes, set:
  - `文档状态: 已评审`
  - `评审结果: 通过`
  - `评审轮次: <actual completed review count>`
  - `修改时间: <latest local time>`

## `last_plan.md` Rules

`last_plan.md` is the project-level, deduplicated plan index for `docs/plans/`. It is maintained after generating project plan documents and is reviewed with the same rigor as an individual plan.

### Required Purpose

- Track all active modification points from the project's plan documents in one place.
- Preserve references to original source documents.
- Make review and execution status visible per modification point and for the overall plan set.
- Prevent duplicate, conflicting, or stale instructions from accumulating across multiple plan documents.

### Required Structure

Use this structure unless the existing `last_plan.md` already has a richer compatible structure. Preserve useful existing fields while ensuring these sections exist:

```markdown
---
title: <项目名称> last_plan
版本: 1.0.0
文档状态: 草稿 | 部分评审 | 全部评审 | 部分执行 | 全部执行 | 需修订
评审状态: 待评审 | 部分评审 | 全部评审 | 需修订
执行状态: 未执行 | 部分执行 | 全部执行
创建时间: <YYYY-MM-DD HH:mm>
修改时间: <YYYY-MM-DD HH:mm>
作者: Codex
评审轮次: 0
评审结果: 待评审 | 需修订 | 通过
---

# <项目名称> last_plan

## 目录

- [1. 汇总状态](#1-汇总状态)
- [2. 来源文档](#2-来源文档)
- [3. 修改点清单](#3-修改点清单)
- [4. 矛盾与去重处理](#4-矛盾与去重处理)
- [5. 评审记录](#5-评审记录)

## 1. 汇总状态

## 2. 来源文档

## 3. 修改点清单

### LP-001 <修改点标题>

- 来源:
  - [<来源文档标题或文件名>](./<source-plan>.md)
- 活跃状态: 活跃 | 已废弃 | 已替代
- 评审状态: 待评审 | 已评审 | 需修订
- 执行状态: 未执行 | 部分执行 | 已执行
- 范围:
- 当前结论:
- 依赖:
- 验收标准:
- 状态记录:
  - <YYYY-MM-DD HH:mm>: <状态变化或整合说明>

## 4. 矛盾与去重处理

## 5. 评审记录
```

### Source Document Rules

- `## 2. 来源文档` must list every Markdown file in `docs/plans/` that has been integrated, with relative links.
- If a Markdown file is intentionally excluded, list it in a separate `未纳入文档` subsection with a reason.
- When a source file is renamed or deleted, keep the historical reference and note that the file is missing or superseded.
- Never paste entire source plans into `last_plan.md`; summarize the modification points and link to the originals.

### Modification Point Rules

- Use stable IDs such as `LP-001`, `LP-002`, and do not renumber existing points.
- Merge duplicates into the older stable ID unless the newer point is materially broader and better supported.
- A modification point can cite multiple source documents.
- Every modification point must include:
  - source references
  - `活跃状态`
  - review status
  - execution status
  - scope or affected modules
  - current conclusion
  - acceptance criteria or verification method
  - status history
- If a source document changes the intended design, status, dependencies, or acceptance criteria of an existing point, append a status history entry and update the point. Do not silently overwrite the previous conclusion.
- After a successful `last_plan.md` review pass, every active modification point that was validated by that pass must be marked `评审状态: 已评审`.
- Modification points marked `活跃状态: 已废弃` or `活跃状态: 已替代` must preserve their source references and history, but they do not count toward overall review or execution status. Record the reason and replacement point ID when applicable.

### Status Consistency Rules

- Per-point valid active statuses are `活跃`, `已废弃`, and `已替代`.
- Per-point valid review statuses are `待评审`, `已评审`, and `需修订`.
- Per-point valid execution statuses are `未执行`, `部分执行`, and `已执行`.
- Overall `评审状态` must be computed from active modification points only:
  - `待评审` when no active modification point is `已评审`;
  - `部分评审` when at least one but not all active modification points are `已评审`;
  - `全部评审` only when every active modification point is `已评审`;
  - `需修订` when any active modification point is `需修订`.
- Overall `执行状态` must be computed from active modification points only:
  - `未执行` when no active modification point has execution progress;
  - `部分执行` when at least one but not all active modification points are `已执行`, or when any point is `部分执行`;
  - `全部执行` only when every active modification point is `已执行`.
- Overall `文档状态` must align with the point statuses:
  - use `需修订` if any active point or review result requires revision;
  - use `全部执行` only when `评审状态: 全部评审` and `执行状态: 全部执行`;
  - use `部分执行` when execution has started but not all active points are executed;
  - use `全部评审` only when all active points are reviewed and execution is not complete;
  - use `部分评审` when review has started but not all active points are reviewed;
  - otherwise use `草稿`.
- The whole plan set cannot be marked `全部评审` or `全部执行` until every active modification point has the matching completed status.

## Review Criteria

Each review pass must check:

- User alignment: the plan answers the stated goal and does not solve an unrelated problem.
- Completeness: background, goals, scope, non-goals, design, rollout, tests, acceptance criteria, risks, and rollback are covered when relevant.
- Reasonableness: the plan is technically feasible and scoped to the observed project.
- Internal consistency: terminology, dependencies, timelines, stages, and assumptions do not contradict each other.
- Contract compatibility: public APIs, data formats, config, environment variables, CLI behavior, database schema, generated files, tests, and deployment expectations remain compatible or have explicit migration steps.
- Operational safety: rollout, monitoring, fallback, rollback, and data safety are addressed for risky changes.
- Testability: the plan includes concrete verification steps and acceptance criteria.

Record individual plan review results in `## 9. 评审记录` as concise entries. Record `last_plan.md` review results in its `## 5. 评审记录` section using the same entry shape:

```markdown
### 第 N 轮评审

- 结论: 需修订 | 通过
- 发现:
  - <具体问题；通过时写“未发现阻塞问题”>
- 修改:
  - <本轮已应用的修改；通过时写“无需修改”>
```

## Git Rules

- If the target project has a git repository, commit only the plan document and directly related files created by this skill.
- Before committing, inspect `git status` and avoid staging unrelated user changes.
- Use a concise Chinese commit message, for example `docs: 新增认证升级方案`.
- If a remote and upstream are configured, push after committing.
- If no remote or upstream exists, do not create one unless the user explicitly asks. Report that the commit stayed local.
- If there are no changes after review, do not create an empty commit.

## Final Response

Report:

- The target project path or paths.
- The generated or updated plan document path or paths.
- The `last_plan.md` path for each target project.
- The final status and review round count for generated plans and `last_plan.md`.
- Whether git commit and push were performed, including the commit hash when available.
- Any assumptions or important gaps that remain.
