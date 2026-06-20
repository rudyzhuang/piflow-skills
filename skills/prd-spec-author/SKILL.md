---
name: prd-spec-author
description: Use when a PiFlow project needs to create, regenerate, or refine the PRD-stage source document `output-stages/prd/prd-spec.md` from `output-stages/setup/canonical-req.json` or `inputs/req.yaml`, especially when preserving valid existing content, correcting requirement conflicts, running source coverage and quality review loops, and producing a stable shared PRD source for downstream per-client authoring.
---

# Prd Spec Author

## Overview

Generate or refine the PiFlow shared PRD source document `output-stages/prd/prd-spec.md`.

This skill is for the PRD stage's Agent-A style shared source document only. It should turn structured requirement truth into one implementation-ready PRD spec that downstream per-client PRD authoring can consume. It is not just a blank-filler: it must preserve valid existing PRD content, correct stale or conflicting content against requirement truth, and finish with coverage and quality review loops before stopping.

## When To Use

Use this skill when:

- the workflow is in PiFlow `prd` stage Agent-A mode
- the target file is `output-stages/prd/prd-spec.md`
- the source of truth is `output-stages/setup/canonical-req.json` or `inputs/req.yaml`
- the user asks to draft, regenerate, refine, or recover the shared PRD spec
- existing PRD content must be preserved when still valid, but corrected when it conflicts with newer requirement truth
- downstream per-client authoring needs a stronger shared contract around scope, flows, cross-client boundaries, exceptions, or deployment semantics

Do not use this skill for:

- writing per-client `prd-*.json`
- syncing deploy/config/runtime files directly
- replacing stage orchestration or hand-authoring final runtime/config matrices

## Inputs

Read, when available:

- `output-stages/setup/canonical-req.json`
- `inputs/req.yaml`
- existing `output-stages/prd/prd-spec.md`

Treat the structured requirement file as business truth. Use the existing PRD file as incremental editing context, not as authority over newer structured inputs.

If both requirement sources exist, prefer the more canonical and up-to-date structured truth. If requirement truth and existing PRD content conflict, requirement truth wins.

## Required Output

Update only:

- `output-stages/prd/prd-spec.md`

Do not create extra summary files unless the caller explicitly asks.

## Authoring Rules

1. Keep the document in Chinese unless the project explicitly uses another language.
2. Preserve valid existing content.
3. Correct stale, conflicting, or semantically drifted content when it no longer matches requirement truth.
4. Fill placeholders, missing rows, missing bullets, missing sections, and weakly specified sections that are insufficient for downstream PRD consumption.
5. Keep these required headings present:
   - `## 产品意图`
   - `## 客户端目标`
   - `## 核心功能`
   - `## 范围与非目标`
   - `## 完整性覆盖`
   - `## 部署架构`
6. `## 客户端目标` must be a flat bullet list of logical targets such as `website`, `admin`, `backend`, `mobile`, `desktop`, or `miniapp`, and should state each target's responsibility boundary when requirement truth makes that clear.
7. `## 核心功能` must include a table whose rows describe globally unique `feature_id` values.
8. Keep cross-client features consistent. The same cross-client feature must not receive different IDs or business meanings in different sections.
9. Do not write secrets, tokens, passwords, device keys, or real credentials into the PRD.

## Minimum Shared PRD Contract

The finished shared PRD should be strong enough for downstream `prd-client-author`, `prd-reviewer`, design, and codegen work. At minimum, make sure the document can clearly express:

- product intent, target users, and business value
- logical client targets and each target's role boundary
- globally shared features and their target mapping
- in-scope, out-of-scope, and explicit non-goals
- happy paths, edge cases, and failure cases
- deployment and routing principles at a product/spec level

When the source truth supports it, also add or strengthen sections such as:

- `## 角色与权限`
- `## 核心用户流程`
- `## 跨端协作与接口契约`
- `## 状态与异常处理`
- `## 依赖与前置条件`

You do not need to force these headings into every file, but you should not omit the underlying information when it materially affects downstream PRD quality.

## Feature ID Rules

- Format: `^[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]{3}$`
- Single-target features should use a target-specific family when appropriate, such as `WEB-*`, `ADMIN-*`, `BACKEND-*`, or `MOB-*`
- Cross-target features should use a business-domain family such as `AUTH-*`, `ORDER-*`, `CONTENT-*`, or `REPORT-*`
- Reuse existing IDs when the feature already exists
- Never create duplicates

## Traceability Rules

When the requirement source exposes stable IDs or clearly separable requirement items, preserve lightweight traceability in the shared PRD feature table or nearby notes. Suitable forms include:

- `source_requirement_ids`
- requirement item IDs
- requirement section paths

Do not turn the PRD into a raw data dump. Keep traceability lightweight but useful for review, recovery, and impact analysis.

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

If requirement truth implies role boundaries, cross-client dependencies, exception handling, or acceptance expectations, make those explicit enough for downstream authors instead of leaving them implicit in a vague summary.

## Deployment Rules

- Keep `## 部署架构`
- Describe platform, environments, and routing principles at a product/spec level
- Do not invent concrete secrets
- Do not hand-author final release/dev URL matrices when the pipeline is expected to deterministically sync them later

## Review Loop

Before finishing, run both loops below and keep fixing until they pass.

### Source Coverage Review Loop

Check whether the requirement truth has been adequately absorbed into the PRD:

- product goals and user value are represented
- client targets and responsibilities are represented
- important feature domains are represented
- scope boundaries and non-goals are represented
- cross-client interactions or contracts are represented when relevant
- edge cases, failures, and exceptions are not silently dropped
- deployment/platform principles are represented at the right abstraction level

If meaningful requirement facts are still missing from the PRD, revise the PRD and run the loop again.

### Shared Spec Quality Review Loop

Check whether the PRD is usable as a downstream shared contract:

- required headings exist
- `## 客户端目标` is non-empty and coherent
- `## 核心功能` has valid, non-duplicated feature rows
- feature meanings are distinct and not contradictory
- stale existing text that conflicts with requirement truth has been corrected
- scope, non-goals, completeness, flows, and exceptions are explicit enough for downstream use
- no section remains as a shallow placeholder when the requirement truth already supports a concrete statement

Before finishing, verify:

- only `output-stages/prd/prd-spec.md` was intended to change
- the required headings still exist
- `## 客户端目标` is non-empty
- `## 核心功能` has at least one valid feature row
- valid existing content was preserved where possible
- conflicting old content was corrected where necessary
- the document is strong enough to drive downstream per-client PRD generation without forcing reviewer-only cleanup of basic omissions

## Final Response

Briefly report:

- that `output-stages/prd/prd-spec.md` was updated
- the main assumptions or preserved constraints, if any
- whether conflicting old content had to be corrected against requirement truth
