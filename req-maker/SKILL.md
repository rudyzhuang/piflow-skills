---
name: req-maker
description: Extract project requirements from the user's prompt and any provided documents, Figma Make local copies (.make), screenshots, or specs, then write a complete Chinese req.md using the PiFlow requirements template. Use when the user asks to create, draft, refine, or regenerate project requirements, especially for PiFlow projects, inputs/req.md, req-template.md, Figma Make UI drafts, or natural-language product ideas that need to become structured requirements.
---

# Req Maker

## Overview

Generate `inputs/req.md` for a project by synthesizing the user's description and supplied materials into the required PiFlow Markdown template. Preserve the template's headings and field names, and write concise, implementation-ready Chinese requirements.

## Workflow

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
   - Check that features are product-facing, priorities and phases are coherent, `client_targets` match the described behavior, dependencies are reflected, non-functional needs are appropriate, and test cases cover the launch-blocking flows.
   - Produce concrete review findings. If findings exist, revise `inputs/req.md` according to them, then repeat this review-and-revise cycle.
   - Stop only when the review passes with no material reasonableness, consistency, or completeness issues.

8. Verify the result.
   - Confirm `inputs/req.md` exists.
   - Check that the required top-level sections from the template are present.
   - Confirm both review loops passed.
   - Briefly report the path written and any important assumptions.

## Drafting Rules

- Write in Chinese unless the user asks for another language.
- Preserve comments only when they help future editing; remove placeholder examples that would confuse the final requirements.
- Use business language for features: describe what users can accomplish and what success looks like.
- Keep feature IDs blank for new features unless the user provides existing IDs.
- Prefer `must` and `mvp` only for truly first-release requirements.
- Include backend in `client_targets` when the feature requires persistence, authentication, integrations, or server-side processing.
- Do not invent real domains, credentials, private data, third-party account details, legal claims, or strict performance numbers.
- Keep test cases focused on the most important launch-blocking flows.

## Review Rules

- Treat review as a mandatory part of generation, not an optional final glance.
- Keep review findings actionable: identify the affected section, describe the issue, and state the required change.
- Apply review suggestions directly to `inputs/req.md`; do not leave a separate review report as the final deliverable unless the user asks for one.
- In each loop, if the review passes, explicitly note that the loop passed in the final response.
- Avoid endless churn: only repeat when there is a material omission, contradiction, unreasonable requirement, or completeness gap.

## Output Checklist

- `## 项目名称 *`
- `## 项目简介 *`
- `## Agent 设置`
- `## 客户端目标 *`
- `## 核心功能 *`
- `## 非功能需求`
- `## 测试用例`
- `## 部署域名`
- `## 鉴权方案`
- `## 技术约束`
- `## 其他说明`

## Bundled Asset

- `assets/req-template.md`: fallback copy of the PiFlow requirements template.

## Helper Scripts

- `scripts/figma-make-summary.mjs`: summarizes a local Figma Make `.make` bundle by reading `meta.json` and `ai_chat.json` through `unzip`, then prints a Markdown source summary suitable for requirement extraction.
