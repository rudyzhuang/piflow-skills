---
name: prd-spec-author
description: Use when a PiFlow project needs to create, regenerate, or incrementally refine the PRD-stage source document `output-stages/prd/prd-spec.md` from `output-stages/setup/canonical-req.json` or `inputs/req.yaml`, especially when preserving existing non-empty sections, client target lists, feature tables, scope boundaries, and deployment-architecture wording is required before per-client PRD generation.
---

# Prd Spec Author

## Overview

Generate or refine the PiFlow PRD source document `output-stages/prd/prd-spec.md`.

This skill is for the PRD stage's cross-client source document only. It should turn structured requirement truth into one incremental, implementation-ready PRD spec that downstream per-client PRD authoring can consume.

## When To Use

Use this skill when:

- the workflow is in PiFlow `prd` stage Agent-A mode
- the target file is `output-stages/prd/prd-spec.md`
- the source of truth is `output-stages/setup/canonical-req.json` or `inputs/req.yaml`
- the user asks to draft, regenerate, refine, or recover the shared PRD spec
- existing non-empty PRD content must be preserved and only placeholders or missing sections should be filled

Do not use this skill for:

- writing per-client `prd-*.json`
- reviewing PRD quality or deciding pass/fail
- syncing deploy/config/runtime files directly

## Inputs

Read, when available:

- `output-stages/setup/canonical-req.json`
- `inputs/req.yaml`
- existing `output-stages/prd/prd-spec.md`

Treat the structured requirement file as business truth. Use the existing PRD file as incremental editing context, not as authority over newer structured inputs.

## Required Output

Update only:

- `output-stages/prd/prd-spec.md`

Do not create extra summary files unless the caller explicitly asks.

## Authoring Rules

1. Preserve existing non-empty content.
2. Only fill placeholders, missing rows, missing bullets, or clearly incomplete sections.
3. Keep the document in Chinese unless the project explicitly uses another language.
4. Keep these required headings present:
   - `## 产品意图`
   - `## 客户端目标`
   - `## 核心功能`
   - `## 范围与非目标`
   - `## 完整性覆盖`
   - `## 部署架构`
5. `## 客户端目标` must be a flat bullet list of logical targets such as `website`, `admin`, `backend`, `mobile`, `desktop`, or `miniapp`.
6. `## 核心功能` must include a table whose rows describe globally unique `feature_id` values.
7. Keep cross-client features consistent. The same cross-client feature must not receive different IDs or business meanings in different sections.
8. Do not write secrets, tokens, passwords, device keys, or real credentials into the PRD.

## Feature ID Rules

- Format: `^[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]{3}$`
- Single-target features should use a target-specific family when appropriate, such as `WEB-*`, `ADMIN-*`, `BACKEND-*`, or `MOB-*`
- Cross-target features should use a business-domain family such as `AUTH-*`, `ORDER-*`, `CONTENT-*`, or `REPORT-*`
- Reuse existing IDs when the feature already exists
- Never create duplicates

## Scope And Readiness Rules

`## 范围与非目标` must clearly separate:

- in-scope items
- out-of-scope items
- explicit non-goals

`## 完整性覆盖` must cover:

- happy paths
- edge cases
- failure cases

If the structured requirement source contains a nuanced product constraint, preserve that nuance instead of simplifying it away.

## Deployment Rules

- Keep `## 部署架构`
- Describe platform, environments, and routing principles at a product/spec level
- Do not invent concrete secrets
- Do not hand-author final release/dev URL matrices when the pipeline is expected to deterministically sync them later

## Quality Check

Before finishing, verify:

- the required headings still exist
- `## 客户端目标` is non-empty
- `## 核心功能` has at least one valid feature row
- no existing non-empty section was unnecessarily rewritten
- scope, non-goals, and completeness are explicit enough for downstream PRD generation

## Final Response

Briefly report:

- that `output-stages/prd/prd-spec.md` was updated
- the main assumptions or preserved constraints, if any
