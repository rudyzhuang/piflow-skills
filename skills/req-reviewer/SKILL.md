---
name: req-reviewer
description: Review and revise existing Chinese requirements documents, especially inputs/req.md, until they pass source coverage, quality, consistency, feature_id, multi-client contract, compatibility, and testability checks. Use when the user asks to 需求评审, 评审需求, 检查需求, 修改需求, 增加需求, review requirements, review req.md, revise requirements, validate inputs/req.md, or mark requirements as 已评审 after multi-round review and revision.
---

# Req Reviewer

## Overview

Review an existing `inputs/req.md`, revise it according to concrete findings, and repeat review-and-revision loops until the requirements pass. The final document must be internally consistent, aligned with source material, compatible with previous requirements when applicable, and marked `已评审`.

Write in Chinese unless the user asks for another language.

## Workflow

1. Locate the target project root.
   - Prefer the current git repository root.
   - If the user names a project path, use that path.
   - If unclear, inspect the current directory for `.git`, `inputs/req.md`, `templates/req-template.md`, `package.json`, or `pyproject.toml`.

2. Locate requirement and source files.
   - Default requirement file: `<project-root>/inputs/req.md`.
   - If the user names another requirement file, use that file and still prefer `inputs/req.md` when present for project compatibility checks.
   - Gather source material from the user's prompt and any referenced documents, Figma Make `.make` bundles, screenshots-transcribed notes, specs, issues, existing plans, templates, and project docs.
   - For Figma Make `.make` files, treat them as zip-like bundles. Prefer using `req-maker/scripts/figma-make-summary.mjs` when it is available in the same skills repo; otherwise inspect `meta.json` and `ai_chat.json` with `unzip`.
   - If this is a requirement modification or addition, locate the previous version where possible: git history for `inputs/req.md`, an explicitly supplied previous document, exported requirement versions, or nearby files such as `inputs/req.prev.md`.

3. Load the requirement template.
   - First try `/Users/rudy/proj/piflow/templates/req-template.md`.
   - If unavailable, try `<project-root>/templates/req-template.md`.
   - If unavailable, try the sibling skill fallback `req-maker/assets/req-template.md` when this skills repo is available.
   - Use the loaded template as the structural contract for `inputs/req.md`: required section names, section order, field names, and allowed enum hints.
   - If no template is readable, continue the semantic review but report that template-format validation was limited.

4. Run template-format and content checks before semantic review.
   - Compare `inputs/req.md` against the loaded template before making any revision.
   - Check required sections and section order, especially `## 项目名称 *`, `## 项目简介 *`, `## Agent 设置`, `## 客户端目标 *`, `## 核心功能 *`, `## 非功能需求`, `## 测试用例`, `## 部署 *` or compatible deployment section, `## 鉴权方案`, and `## 技术约束`.
   - Check core fields are present when relevant: `feature_id`, `priority`, `phase`, `client_targets`, `structured_source`, `freeform_source`, `freeform_content`, `description`, `user_stories`, `acceptance_criteria`, `dependencies`, test case fields, deployment fields, and auth fields.
   - Check the `## 核心功能 *` section header, before the first `### Feature:`, contains project-level `freeform_source:` and `freeform_content:` fields. This project-level `freeform_content` summarizes the overall functional capability set across all features.
   - Check every feature block contains a non-empty `freeform_content:` field. The value must be a natural-language description of that feature's functional intent, not a copy of the whole project summary, not only the title, and not a YAML field dump.
   - Check the document does not leave confusing template comments, copied placeholder examples, empty required business sections, or invalid placeholder values as final content.

5. Back up before the first write.
   - Before the first modification to `inputs/req.md`, create exactly one backup copy.
   - Use `<project-root>/inputs/backups/req-<yyyymmdd-HHmmss>.md` with local time.
   - Create `inputs/backups/` if needed.
   - Do not create a backup if the review finds no changes are needed.
   - Include the backup path in the final response and, when committing, include this backup file as a directly related review artifact.

6. Inspect project contracts when relevant.
   - Read targeted project files that define current behavior and contracts: README, docs, API route definitions, schemas, migrations, config, env examples, type definitions, generated clients, tests, package manifests, and deployment configuration.
   - For multi-client requirements, identify all affected clients, such as `website`, `admin`, `backend`, `mobile`, `desktop`, or `miniapp`, and the contracts between them.
   - Do not invent implementation facts. Use explicit assumptions when evidence is missing.

7. Run the review.
   - Check source coverage: whether `req.md` omitted or misunderstood user input, documents, Figma Make intent, screenshots, specs, issues, or other supplied sources.
   - Check requirements quality: reasonableness, completeness, consistency, product-facing wording, priorities, phases, dependencies, client targets, non-functional requirements, test cases, acceptance criteria, auth, deployment, and technical constraints.
   - Check project-level freeform provenance: if the overall functional description came from user prompt, documents, Figma Make, screenshots, Backend export, or req-maker source material and was then organized by AI, mark `freeform_source: from_user`; if it is inferred only by summarizing already-structured features during review, mark `freeform_source: from_ai`.
   - Check feature-level freeform provenance: preserve a user-provided feature freeform description as `from_user`; when the field is missing or empty and the reviewer infers it from `description`, `user_stories`, `acceptance_criteria`, `client_targets`, or neighboring context, fill it and mark `freeform_source: from_ai`.
   - Check `feature_id`: presence, uniqueness, valid format, stable preservation for existing features, appropriate prefix, and consistent use in dependencies and test cases.
   - For multi-client requirements, check contract consistency and completeness across clients: shared data model, API semantics, auth and permission rules, state transitions, error handling, empty/loading states, routing, deployment assumptions, and test coverage.
   - For modifications or additions, check backward compatibility with the previous requirement version: existing feature IDs, client targets, API/data expectations, accepted behavior, migration impact, and whether breaking changes are explicitly called out with migration or rollout steps.

8. Revise directly.
   - Produce concrete findings internally, then apply fixes directly to the requirement document.
   - Keep the existing template headings and field names unless the user explicitly asks to change the template.
   - Preserve Backend/export traceability fields when present, including `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status`.
   - Preserve existing non-empty `freeform_content` when it matches the feature scope and contains no sensitive information. If it is missing, empty, a template placeholder, copied from another feature, or only repeats the heading, replace it with a concise natural-language functional description and set `freeform_source: from_ai`.
   - Add project-level `freeform_source:` and `freeform_content:` immediately after `## 核心功能 *` and before the first feature when missing. Use `from_user` when source material contains the overall product/function description; otherwise summarize the reviewed features and use `from_ai`.
   - Preserve existing valid `feature_id` values for unchanged features.
   - Generate or repair `feature_id` only when a new feature lacks one or an existing value is invalid.
   - Do not write secrets, auth headers, device keys, stack traces, or private credentials into `req.md`.

9. Repeat until approved.
   - After every revision, run another full review.
   - Continue while there are material omissions, misunderstandings, contradictions, malformed IDs, weak test coverage, incompatible multi-client contracts, missing dependencies, unhandled migration impact, or unreasonable requirements.
   - Stop only when the review passes with no material findings.
   - When the final review passes, mark the requirement document as `已评审`.

10. Verify and finalize.
   - Confirm the requirement file exists.
   - Confirm required top-level sections are present and ordered according to the loaded PiFlow template when a template was readable.
   - Confirm the final status is `已评审`.
   - Confirm the review loop passed and the final document contains either a review summary or clearly updated review/status metadata.
   - Confirm a backup was created if `inputs/req.md` was modified.
   - If the local project is a git repository, commit only `inputs/req.md`, its backup file, and directly related review files changed by this skill.
   - If a remote and upstream are configured and reachable, push after committing. If not, leave the commit local and report why.

## Status Metadata

If `inputs/req.md` already has a metadata block or status field, preserve its style and update it. If there is no status metadata, add a concise block near the top of the document, after the title or project-name section, using the least disruptive format.

Recommended fields:

```markdown
> 文档状态: 已评审
> 评审结果: 通过
> 评审轮次: <actual completed review count>
> 修改时间: <YYYY-MM-DD HH:mm>
```

Valid statuses include `草稿`, `评审中`, `已评审`, `已执行`, `已废弃`, and `需修订`.

## Review Criteria

Each review pass must check:

- Template format: the document follows the loaded PiFlow `req-template.md` section order and field contract.
- Source coverage: all user inputs, documents, Figma Make sources, screenshots, specs, and issues are reflected without distortion.
- Completeness: required sections, features, non-functional requirements, test cases, deployment, auth, technical constraints, risks, and notes are present when relevant.
- Reasonableness: requirements are feasible, appropriately scoped, and product-facing.
- Consistency: terms, feature IDs, client targets, priorities, phases, dependencies, acceptance criteria, and tests agree with each other.
- Freeform coverage: `## 核心功能 *` has project-level `freeform_content`, and every feature has non-empty `freeform_content` whose scope matches that feature.
- Freeform source: `freeform_source` uses `from_user` for user-sourced freeform descriptions and `from_ai` for reviewer-inferred descriptions. Treat legacy `user` as `from_user` and legacy `ai` as `from_ai`; revise final documents to the `from_*` form when editing nearby fields.
- Feature IDs: IDs are present for new features, unique, stable for existing features, valid, and consistently referenced.
- Priority and phase: `must/should/nice` and `mvp/v1/later` choices match business criticality and release scope.
- Client targets: each feature's targets match the actual required surfaces.
- Multi-client contracts: shared entities, APIs, permissions, states, errors, and cross-client flows are complete and compatible.
- Compatibility: additions or changes do not silently break previous requirements; breaking changes include migration, rollout, and acceptance notes.
- Testability: launch-blocking paths, multi-client flows, error cases, and compatibility risks have test cases or acceptance criteria.

## Feature ID Rules

- Format: `^[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]{3}$`.
- Use uppercase ASCII segments separated by `-`, ending with a three-digit sequence such as `001`.
- Normalize client prefixes:
  - `website`, `web`, `frontend` -> `WEB`
  - `admin` -> `ADMIN`
  - `backend`, `api` -> `BACKEND`
  - `mobile`, `ios`, `android` -> `MOB`
- Single-target features use the target prefix.
- Multi-target features use a business domain prefix, such as `AUTH`, `USER`, `ORDER`, `NOTE`, `TASK`, `FILE`, `CONTENT`, `SEARCH`, `REPORT`, `PAY`, `BILLING`, `VIDEO`, `AI`, or `PROJ`.
- Continue numbering from existing IDs and avoid duplicates globally.
- Use the same `feature_id` in dependencies and mapped test cases.

## Review Record

Prefer appending a concise review record to an existing review section. If no such section exists, add `## 评审记录` near the end of the document.

```markdown
### 第 N 轮评审

- 结论: 需修订 | 通过
- 发现:
  - <具体问题；通过时写“未发现阻塞问题”>
- 修改:
  - <本轮已应用的修改；通过时写“无需修改”>
```

Do not leave a separate review report as the only deliverable unless the user explicitly asks for one.

## Freeform Content Rules

The reviewer must keep two levels of freeform requirement text:

- Project-level: under `## 核心功能 *`, before the first `### Feature:`, write `freeform_source:` and `freeform_content:`. This describes the overall functional capability set of the project by summarizing what users can accomplish across all features.
- Feature-level: inside every `### Feature:` block, write `freeform_source:` and `freeform_content:`. This describes the natural-language functional intent of that specific feature.

Source rules:

- Use `freeform_source: from_user` when the text comes from user-provided source material, including a prompt, document, Figma Make bundle, screenshot notes, Backend export, or req-maker generated draft based on those sources. AI cleanup, wording normalization, and organization do not change the source from user to AI.
- Use `freeform_source: from_ai` when the reviewer creates the text from structured fields because the original document had no usable freeform text.
- Legacy values are accepted for reading only: `user` means `from_user`; `ai` means `from_ai`.

Revision rules:

- If a feature lacks `freeform_content` or its value is empty, infer a concise natural-language description from the feature's heading, `description`, `user_stories`, `acceptance_criteria`, `client_targets`, and dependencies; then set `freeform_source: from_ai`.
- If project-level `freeform_content` is missing, use the user's overall source description when available and set `from_user`; otherwise summarize all feature-level descriptions and set `from_ai`.
- Do not put secrets, tokens, api keys, stack traces, or private credentials into `freeform_content`.
- Do not use `freeform_content` to add new business scope that is not supported by the source material or existing structured fields.

## Git Rules

- Before committing, inspect `git status` and avoid staging unrelated user changes.
- Commit only the requirement document, the pre-modification backup under `inputs/backups/`, and directly related review artifacts changed by this skill.
- Use a concise Chinese commit message, for example `docs: 评审并修订需求文档`.
- If no changes are needed after review and the document is already `已评审`, do not create an empty commit.
- If a remote or upstream is missing, do not create one unless the user explicitly asks.

## Final Response

Report:

- The reviewed requirement file path.
- The template path used for format validation, or that template validation was limited.
- The backup path when a backup was created.
- Final status and review round count.
- High-level categories of issues fixed.
- Whether git commit and push were performed, including the commit hash when available.
- Any assumptions or remaining gaps.
