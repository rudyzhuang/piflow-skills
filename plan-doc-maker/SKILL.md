---
name: plan-doc-maker
description: Generate Chinese proposal, solution, architecture, implementation, migration, refactor, or upgrade plan documents under docs/plans/ from user requests. Use when the user asks to create, draft, review, refine, or finalize a 方案文档, 技术方案, 实施方案, 改造方案, 升级方案, 迁移方案, 架构方案, or project plan, especially when the plan must be reviewed against the current repository before being marked reviewed and committed or pushed.
---

# Plan Doc Maker

## Overview

Create a project-local plan document in `docs/plans/`, then run mandatory review-and-revision loops until the plan is reasonable, complete, internally consistent, and compatible with the current project contracts. Write in Chinese unless the user asks for another language.

## Workflow

1. Locate the target project root.
   - Prefer the current git repository root.
   - If the user names a path, use that path.
   - If no git repository exists, use the current workspace root.

2. Gather context.
   - Read the user's request and any provided files, notes, issues, screenshots, existing plans, requirements, or design docs.
   - Inspect the current project before proposing changes. Prefer targeted reads of files that define contracts and architecture, such as `README*`, `docs/`, `package.json`, `pyproject.toml`, API route definitions, schemas, migrations, config files, tests, types, interfaces, and existing conventions.
   - If the plan modifies or upgrades an existing project, identify relevant compatibility surfaces: public APIs, CLI commands, file formats, database schema, environment variables, authentication, permissions, deployment behavior, tests, and migration paths.
   - If important context is unavailable, continue with explicit assumptions instead of blocking unless the missing fact would make the plan unsafe.

3. Choose the output path.
   - Create `<project-root>/docs/plans/` if needed.
   - Use local time for the file prefix, formatted as `<yyyymmdd-HHmm>`.
   - Generate a short ASCII lowercase slug for the main proposal purpose, such as `auth-upgrade`, `api-refactor`, `billing-migration`, or `plan-doc-maker`.
   - Write to `<project-root>/docs/plans/<yyyymmdd-HHmm>-<proposal>.md`.
   - If the target file already exists, append a short disambiguator such as `-v2`.

4. Draft the first version.
   - Start with a metadata block, then a Markdown table of contents, then the plan body.
   - Use concrete, executable planning language. Avoid vague recommendations that cannot guide implementation.
   - When planning changes to an existing codebase, tie recommendations back to observed files, modules, contracts, and compatibility constraints.

5. Review the draft.
   - Review the document against the user's request and the project context.
   - Check reasonableness, completeness, internal consistency, feasibility, scope control, risks, rollback, testability, and acceptance criteria.
   - For existing-project modifications or upgrades, place extra weight on contract consistency and compatibility with the current codebase.
   - Produce concrete findings internally and apply fixes directly to the plan document. Do not leave a separate review report unless the user asks for one.

6. Repeat review and revision until approved.
   - After every revision, run another review.
   - Continue while there are material omissions, contradictions, unreasonable steps, unhandled risks, incompatible assumptions, or gaps against project contracts.
   - Stop only when the review passes.
   - When the review passes, update the document status to `已评审` and refresh the modified time.

7. Verify and finalize.
   - Confirm the file exists under `docs/plans/`.
   - Confirm the filename follows `<yyyymmdd-HHmm>-<proposal>.md`.
   - Confirm the metadata block, table of contents, plan sections, review notes or review summary, and final `文档状态: 已评审` are present.
   - If the local project is a git repository, commit the generated or updated plan document.
   - If a remote for the current branch is configured and reachable, push the commit. If there is no remote, no upstream, or push is unsafe, leave the commit local and report why.

## Document Structure

Use this structure by default. Add or remove sections when the user's requested plan calls for it, but keep the metadata block and table of contents.

```markdown
---
title: <方案标题>
版本: 1.0.0
文档状态: 草稿
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
- `创建时间` is the initial local timestamp and must not change after creation.
- `修改时间` is refreshed whenever the document is materially revised.
- `评审轮次` records the number of completed review passes.
- `评审结果` is `待评审`, `需修订`, or `通过`.
- When the final review passes, set:
  - `文档状态: 已评审`
  - `评审结果: 通过`
  - `评审轮次: <actual completed review count>`
  - `修改时间: <latest local time>`

## Review Criteria

Each review pass must check:

- User alignment: the plan answers the stated goal and does not solve an unrelated problem.
- Completeness: background, goals, scope, non-goals, design, rollout, tests, acceptance criteria, risks, and rollback are covered when relevant.
- Reasonableness: the plan is technically feasible and scoped to the observed project.
- Internal consistency: terminology, dependencies, timelines, stages, and assumptions do not contradict each other.
- Contract compatibility: public APIs, data formats, config, environment variables, CLI behavior, database schema, generated files, tests, and deployment expectations remain compatible or have explicit migration steps.
- Operational safety: rollout, monitoring, fallback, rollback, and data safety are addressed for risky changes.
- Testability: the plan includes concrete verification steps and acceptance criteria.

Record review results in `## 9. 评审记录` as concise entries:

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

- The plan document path.
- The final status and review round count.
- Whether git commit and push were performed, including the commit hash when available.
- Any assumptions or important gaps that remain.
