---
name: req-maker
description: Extract project requirements from prompts, documents, Figma Make local copies (.make), screenshots, specs, or PiFlow req-md-export data, then write a complete Chinese req.md using the PiFlow requirements template. Use when the user asks to create, draft, refine, regenerate, export, render, or review requirements, especially for PiFlow projects, inputs/req.md, req-template.md, Backend req-md-export, Figma Make UI drafts, or natural-language product ideas that need to become structured requirements.
---

# Req Maker

## Overview

Generate `inputs/req.md` for a project by synthesizing the user's description and supplied materials into the required PiFlow Markdown template. Preserve the template's headings and field names, and write concise, implementation-ready Chinese requirements.

This skill has two modes:

- `draft-from-sources`: the default mode for natural-language prompts, product notes, Figma Make bundles, screenshots, and other source documents.
- `export-req-md`: the PiFlow CLI/export mode for data returned by Backend `GET /api/v1/projects/:id/req-md-export`. In this mode, Backend export data is the only business source, traceability fields must be preserved, and no new business facts may be invented.

Use `export-req-md` when the user mentions `req-md-export`, `ReqMdExportDocument`, `project_id` plus `device_api_key`, piflow-cli `start` handling, or asks to make this skill compatible with the req-review export/render flow.

## Draft-From-Sources Workflow

1. Locate the project root.
   - Prefer the current repository/workspace root.
   - If the user names a project path, use that path.
   - If unclear, inspect the current directory for common markers such as `.git`, `package.json`, `pyproject.toml`, or existing `inputs/`.

2. Gather source material.
   - Read the user's prompt carefully.
   - Read any files, docs, screenshots-transcribed notes, specs, issue descriptions, or templates the user provides.
   - If the user provides a Figma Make local copy (`*.make`), treat it as a zip-like source bundle:
     - Inspect it with `file` and `unzip -l` when available.
     - Prefer running this skill's helper script: `node scripts/figma-make-summary.mjs <path-to-file.make>`.
     - Extract and use `meta.json` for file name, export time, thumbnail size, and canvas render coordinates.
     - Extract and use `ai_chat.json` for the original UI prompt, subsequent user change requests, assistant implementation summaries, and `makeVersions`.
     - Treat `canvas.fig` as Figma Make's binary canvas data. Do not claim to parse its full layer tree unless a suitable parser is available; rely on `ai_chat.json`, screenshots, and thumbnails for requirement extraction.
     - If the remote Figma MCP cannot access the Make file but a local `.make` is readable, continue from the local bundle instead of blocking on MCP access.
   - If a referenced file is missing or unreadable, continue from available context and note the gap.

3. Load the template.
   - Prefer a project-local template when available, especially `templates/req-template.md`.
   - Otherwise use this skill's bundled fallback: `assets/req-template.md`.
   - Keep all template headings and field names unless the user explicitly asks to change the template.

4. Extract and normalize requirements.
   - Identify project name, target users, value proposition, client targets, features, non-functional needs, test cases, deployment domain, auth plan, technical constraints, release scope, risks, and notes.
   - For Figma Make sources, preserve the chronological product intent:
     - Use the first user prompt as the baseline product/design brief.
     - Apply later user messages as requirement deltas, especially changes to features, navigation, status behavior, filters, integrations, and page layout.
     - Use version titles as evidence of feature evolution, not as final user-facing requirement names unless they are clear.
     - Convert UI-only elements into product requirements when they imply behavior, state, validation, empty/loading states, or integration needs.
   - Convert vague ideas into product-facing requirements, not implementation chores.
   - Keep `priority`, `phase`, and `client_targets` consistent with the template vocabulary.
   - Generate `feature_id` for every new feature according to the PiFlow naming rules below; do not leave generated feature IDs blank.
   - If information is missing but can be reasonably inferred, fill it and avoid overexplaining.
   - If information is genuinely unknown, write `暂不确定` or leave the field empty when the template allows it.

5. Write the initial output file.
   - Create `<project-root>/inputs/` if needed.
   - Write the initial document to `<project-root>/inputs/req.md`.
   - Do not write to `outputs/` unless the user explicitly asks for an exported copy.
   - Use `apply_patch` for manual edits when possible.

6. Run a source-coverage review loop.
   - Review `inputs/req.md` against the user's prompt and every readable input document or supplied material.
   - Check whether any project facts, constraints, user goals, feature expectations, testable flows, target clients, risks, deadlines, auth needs, domains, or technical notes from the sources were omitted or distorted.
   - Produce concrete review findings. If findings exist, revise `inputs/req.md` according to them, then repeat this review-and-revise cycle.
   - Stop only when the review finds no material source-coverage gaps.

7. Run a requirements-quality review loop.
   - Review the revised `inputs/req.md` again for requirement reasonableness, internal consistency, and completeness.
   - Check that features are product-facing, priorities and phases are coherent, generated `feature_id` values are unique and valid, `client_targets` match the described behavior, dependencies are reflected, non-functional needs are appropriate, and test cases cover the launch-blocking flows.
   - Produce concrete review findings. If findings exist, revise `inputs/req.md` according to them, then repeat this review-and-revise cycle.
   - Stop only when the review passes with no material reasonableness, consistency, or completeness issues.

8. Verify the result.
   - Confirm `inputs/req.md` exists.
   - Check that the required top-level sections from the template are present.
   - Confirm both review loops passed.
   - Briefly report the path written and any important assumptions.

## Export-Req-Md Workflow

Use this workflow instead of the draft workflow when the input is a Backend requirement export or a request to implement the `req-review` design.

When a shell is available, prefer running this skill's helper script for this workflow:

```bash
node scripts/export-req-md.mjs --input <export.json-or.md> --output <project>/inputs/req.md
```

For API mode:

```bash
node scripts/export-req-md.mjs \
  --api-base-url <api-base-url> \
  --project-id <project-id> \
  --device-api-key <device-api-key> \
  --workspace-root <workspace-root>
```

1. Receive export context.
   - Expected fields may include `mode: export-req-md`, `api_base_url`, `project_id`, `run_id`, `device_api_key`, `workspace_root`, `template_path`, and `output_path`.
   - Default `output_path` to `<workspace_root>/<project_id>/inputs/req.md` when both `workspace_root` and `project_id` are known.
   - Treat `device_api_key` and any Bearer token as secrets. Use them only for the request; never write them to `req.md`, logs, review notes, or final summaries.

2. Fetch or read the requirement export.
   - If API context is provided, call `GET /api/v1/projects/:id/req-md-export` with `Authorization: Bearer <device_api_key>`.
   - Accept either `application/json` structured data or `text/markdown` rendered Markdown.
   - If the user directly provides a JSON or Markdown export file, use that file instead of making a network request.
   - Map HTTP failures to safe error summaries: `401 -> REQ_EXPORT_AUTH_FAILED`, `403 -> REQ_EXPORT_FORBIDDEN`, `404 -> REQ_EXPORT_NOT_FOUND`, `422/invalid data -> REQ_EXPORT_INVALID`, network failures -> `REQ_EXPORT_NETWORK_ERROR`.

3. For structured JSON, validate and normalize `ReqMdExportDocument`.
   - Required top-level data: `template_ref`, `project_name.name_zh`, `project_name.name_en`, `project_summary`, `client_targets`, `features`, `test_cases`, `non_functional`, `deployment`, `auth`, `tech_constraints`, and `other_notes`.
   - Default `agent.agent_provider` to `codex` and `agent.agent_model` to `gpt-5.5` when absent.
   - Validate enums:
     - `client_targets[].target`: `website | admin | backend | mobile | desktop | miniapp`
     - `features[].version_status`: `draft | ai-reviewed | reviewed`
     - `features[].priority`: `must | should | nice`
     - `features[].phase`: `mvp | v1 | later`
     - `test_cases[].type`: `smoke | e2e | api | regression | edge | error`
   - Normalize string fields with trim and array fields to arrays.
   - Required feature traceability fields: `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, `version_status`. `source_item_id` may be empty only for non-derived items.
   - Required test case traceability fields: `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status`. `source_item_id` may be empty only for non-derived items.
   - Require and validate Feature `structured_content`, `structured_source`, `freeform_content`, and `freeform_source`; `structured_source` and `freeform_source` must be `user | ai`.
   - Require and validate Test Case `structured_content`, `structured_source`, `freeform_content`, and `freeform_source`; `structured_source` and `freeform_source` must be `user | ai`.
   - For AI-derived features or test cases (`structured_source: ai`), require `source_item_id` so the derived structured item can trace back to its original freeform item.
   - Reject or fail review when `features[]` or `test_cases[]` contains an original freeform source item that was already split into derived structured items. Backend should exclude those source items before export; the skill must not duplicate them in `req.md`.
   - Required feature content fields: `heading_title`, `priority`, `phase`, `client_targets`, and `description`. Prefer values from `structured_content` for template fields; if `description` is empty and `freeform_content` exists, use `freeform_content` only as a description fallback.
   - Preserve Backend-provided non-empty `feature_id` exactly. In this export mode, `feature_id` may be empty when Backend intentionally leaves new features for later PiFlow stages, but do not remove the field.

4. Load the template for export rendering.
   - Prefer the provided `template_path`.
   - Otherwise prefer `/Users/guodongzhuang/github/piflow/templates/req-template.md` when readable.
   - Otherwise use this skill's bundled fallback: `assets/req-template.md`.
   - For piflow-cli export mode, prefer the piflow repository template structure when available: `## 部署 *` with `cloud_provider` and `domain=`.
   - If using the bundled fallback, `## 部署域名` with `DOMAIN=` is acceptable.
   - Use the template for section order and field names; do not copy instructional comments into the final output.

5. Render structured JSON to Markdown.
   - Always output required sections in template order.
   - Render client targets as `- <target>: <positioning>` and include `layout_shell`, `default_route`, and `menu` for admin layout when present.
   - Render each feature as `### Feature: <heading_client> 端 - <heading_title>`.
   - Include these fields in every feature block when available, in this order: `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, `version_status`, `feature_id`, `priority`, `phase`, `client_targets`, `description`, `user_stories`, `acceptance_criteria`, `dependencies`.
   - In `acceptance_criteria`, automatically include traceability lines for `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status` before business criteria so reports can map back to requirement versions and split source items.
   - Do not render Backend-only fields except explicit traceability fields. In particular, do not render `structured_source`, `freeform_source`, `structured_content`, or `freeform_content` as standalone output fields.
   - Render each test case as `### TC-001: <title>` with `feature_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, `version_status`, `client_target`, `type`, `priority`, `preconditions`, `steps`, `expected`, and `test_data`.
   - Use `  -` list indentation. For empty arrays, preserve the section and output a single empty list placeholder.
   - For deployment domains, write only a host/domain value. Do not include `https://` or paths such as `/admin`, `/website`, or `/api`.

6. For rendered Markdown responses, use compatibility mode.
   - Do not re-parse and re-render business fields.
   - Validate required section presence, required section order, and sensitive information rules.
   - If validation passes, write the Markdown directly to `inputs/req.md`.
   - If validation fails, return `REQ_EXPORT_INVALID` and a safe summary explaining which section or rule is incompatible.

7. Run export self-checks before writing or finalizing.
   - Required sections must exist and appear in template order.
   - Accept either the piflow export deployment section (`## 部署 *`) or the bundled draft section (`## 部署域名`) according to the chosen template.
   - Each `### Feature:` block must contain `feature_id:`, `priority:`, `phase:`, `client_targets:`, `description:`, `user_stories:`, `acceptance_criteria:`, and `dependencies:`.
   - Each Backend-derived feature must contain `requirement_id:`, `item_id:`, `source_item_id:`, `version_number:`, `version_hash:`, and `version_status:`.
   - Each Backend-derived test case must contain `item_id:`, `source_item_id:`, `version_number:`, `version_hash:`, `version_status:`, `client_target:`, `type:`, and `priority:`.
   - AI-derived features and test cases must preserve `source_item_id`; original freeform source items that were split must not be rendered again.
   - `domain=` or `DOMAIN=` must not contain protocol or path.
   - Output must not contain `device_api_key`, `cursor_api_key`, `api_key_hash`, `Authorization`, `Bearer <token>`, Admin session cookies, or internal stack traces.

8. Write result and return a concise status.
   - Create parent directories as needed.
   - Overwrite an existing `inputs/req.md` when export mode is explicitly requested.
   - On success, report `status`, `output_path`, `source_format`, `template_ref`, `feature_count`, `test_case_count`, and warnings.
   - On failure, report `status: failed`, `error_code`, `error_summary`, and `safe_for_run_status: true` with secrets redacted.

## Drafting Rules

- Write in Chinese unless the user asks for another language.
- Preserve comments only when they help future editing; remove placeholder examples that would confuse the final requirements.
- Use business language for features: describe what users can accomplish and what success looks like.
- Preserve existing non-empty feature IDs for existing features.
- Generate feature IDs for new features; never leave a new feature's `feature_id` blank.
- In `export-req-md` mode, preserve Backend-provided feature IDs and traceability fields exactly; do not generate missing feature IDs unless the caller explicitly asks for draft-style normalization.
- Prefer `must` and `mvp` only for truly first-release requirements.
- Include backend in `client_targets` when the feature requires persistence, authentication, integrations, or server-side processing.
- Do not invent real domains, credentials, private data, third-party account details, legal claims, or strict performance numbers.
- Keep test cases focused on the most important launch-blocking flows.

## Feature ID Rules

- Format: `^[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]{3}$`.
- Use uppercase ASCII segments separated by `-`, ending with a three-digit sequence such as `001`.
- Normalize client targets before choosing a prefix:
  - `website`, `web`, `frontend` -> `WEB`
  - `admin` -> `ADMIN`
  - `backend`, `api` -> `BACKEND`
  - `mobile`, `ios`, `android` -> `MOB`
- Single-target features use the target prefix: `WEB-SEARCH-001`, `ADMIN-USER-001`, `BACKEND-HEALTH-001`, `MOB-SCAN-001`.
- Multi-target features use a business domain prefix, not a client prefix, even when one target is `backend`: `AUTH-LOGIN-001`, `NOTE-CRUD-001`, `ORDER-CHECKOUT-001`.
- Pick a concise business domain from the feature name and source material, for example `AUTH`, `USER`, `ORDER`, `NOTE`, `TASK`, `FILE`, `CONTENT`, `SEARCH`, `REPORT`, `PAY`, `BILLING`, `VIDEO`, `AI`, `PROJ`.
- Use a short action or area segment after the prefix when it improves clarity, for example `LOGIN`, `CRUD`, `LIST`, `DETAIL`, `EXPORT`, `UPLOAD`, `SYNC`, `SETTINGS`.
- Number from `001` and increment within the same prefix/action family. If existing IDs are present in the current `req.md`, `req.yaml`, PRD files, or source material, continue from the highest used number for that family and avoid duplicates globally.
- Use the same `feature_id` in test cases and dependencies. When a test clearly maps to a generated feature, fill its `feature_id` with that value.
- During quality review, fail and revise if any feature ID is blank, duplicated, malformed, uses a client prefix for a multi-target feature, or uses the wrong client prefix for a single-target feature.

## Review Rules

- Treat review as a mandatory part of generation, not an optional final glance.
- Keep review findings actionable: identify the affected section, describe the issue, and state the required change.
- Apply review suggestions directly to `inputs/req.md`; do not leave a separate review report as the final deliverable unless the user asks for one.
- In each loop, if the review passes, explicitly note that the loop passed in the final response.
- Avoid endless churn: only repeat when there is a material omission, contradiction, unreasonable requirement, or completeness gap.

## Export Compatibility Rules

- Backend `req-md-export` data is the single source of business truth in `export-req-md` mode.
- Preserve traceability fields in feature blocks and acceptance criteria: `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status`.
- Preserve test case traceability fields: `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status`.
- Prefer `structured_content` values over duplicated top-level template fields when rendering Backend export JSON.
- Treat `freeform_content` as a fallback only; never render it as a standalone section.
- Support AI one-to-many freeform splitting by rendering only derived structured items and preserving their `source_item_id`; do not duplicate the original split freeform item.
- Support both future structured JSON (`ReqMdExportDocument`) and current rendered Markdown (`text/markdown; charset=utf-8`) responses.
- Prefer structured JSON for validation and rendering. Treat rendered Markdown as a temporary compatibility path that receives structural and security validation only.
- Do not write secret request inputs or auth headers into `req.md` or user-visible error summaries.
- In export mode, use failure codes compatible with piflow-cli run status: `REQ_EXPORT_AUTH_FAILED`, `REQ_EXPORT_FORBIDDEN`, `REQ_EXPORT_NOT_FOUND`, `REQ_EXPORT_NETWORK_ERROR`, `REQ_EXPORT_INVALID`, `REQ_TEMPLATE_MISSING`, `REQ_RENDER_FAILED`, and `REQ_WRITE_FAILED`.

## Output Checklist

- `## 项目名称 *`
- `## 项目简介 *`
- `## Agent 设置`
- `## 客户端目标 *`
- `## 核心功能 *`
- `## 非功能需求`
- `## 测试用例`
- `## 部署域名` for bundled draft template, or `## 部署 *` for piflow-cli export template
- `## 鉴权方案`
- `## 技术约束`
- `## 其他说明`

## Bundled Asset

- `assets/req-template.md`: fallback copy of the PiFlow requirements template.

## Helper Scripts

- `scripts/figma-make-summary.mjs`: summarizes a local Figma Make `.make` bundle by reading `meta.json` and `ai_chat.json` through `unzip`, then prints a Markdown source summary suitable for requirement extraction.
- `scripts/export-req-md.mjs`: fetches or reads a Backend `req-md-export` JSON/Markdown response, validates traceability and section rules, renders structured JSON to `req.md`, and writes the result to `inputs/req.md`.
