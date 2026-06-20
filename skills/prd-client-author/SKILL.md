---
name: prd-client-author
description: Use when a PiFlow project needs to create, regenerate, or refine one per-client PRD artifact such as `output-stages/prd/prd-website.json`, `prd-admin.json`, `prd-backend.json`, or `prd-mobile.json` plus the matching `feature_list-<client_target>.md`, especially when the workflow injects a single `client_target`, schema expectations, and the shared source document `output-stages/prd/prd-spec.md`, and the author must project shared features into a target-specific implementation contract with completeness review.
---

# Prd Client Author

## Overview

Generate or refine one PiFlow per-client PRD JSON plus its feature list.

This skill is for PRD stage Agent-B style work. It consumes the shared `prd-spec.md`, focuses on one `client_target`, and writes only that target's artifacts. It should behave like a per-client PRD contract author, not a field-by-field filler: decide which shared features belong to the target, express them from the target's point of view, preserve valid fields, correct stale conflicting fields, and finish with a target-level completeness review.

## When To Use

Use this skill when:

- the workflow is generating one `prd-*.json` file for a single client target
- the target is `website`, `admin`, `backend`, `mobile`, `desktop`, `miniapp`, or a mapped alias
- the caller provides or implies a canonical target file and schema
- the job is to incrementally fill a per-client PRD, not to review it
- the target output needs to remain schema-compatible while becoming more executable for design, implementation, and downstream review

Do not use this skill for:

- editing `output-stages/prd/prd-spec.md`
- writing multiple client PRDs at once in one output
- deciding PRD review pass/fail

## Inputs

Read, when available:

- `output-stages/prd/prd-spec.md`
- the current target content file such as `output-stages/prd/prd-website.json`
- `output-stages/prd/feature_list-<client_target>.md`

If the workflow injects a canonical target path, trust that path.

Treat the shared `prd-spec.md` as the shared semantic source. Treat the current target JSON and feature list as incremental editing context, not as authority over newer shared PRD truth.

## Allowed Outputs

Write only the current target's files:

- `output-stages/prd/prd-<target>.json`
- `output-stages/prd/feature_list-<client_target>.md`

Do not modify other targets' PRD files.

## Authoring Rules

1. Only edit the current target.
2. Preserve existing valid fields where possible.
3. Correct existing fields when they conflict with the shared PRD or the current target's contract.
4. Add missing fields, missing features, missing acceptance criteria, and missing top-level metadata incrementally.
5. Keep the document in Chinese unless the project explicitly uses another language.
6. Every feature must include:
   - `feature_id`
   - `name`
   - `priority`
   - `phase`
   - `description`
   - non-empty `acceptance`
7. Cross-client features must keep the exact same `feature_id` as the shared PRD source.
8. A target feature should reflect the current target's own contract and surface area, not merely repeat the shared feature summary verbatim.

## Target Projection Rules

Before writing, decide which shared features the current target should actually own.

Include a shared feature when:

- the shared feature's target mapping explicitly includes the current target
- the current target has a real user surface, API contract, route, role, resource dependency, or implementation responsibility for that feature
- the shared feature is cross-client and the current target has a concrete participation boundary

Do not include a shared feature when:

- it belongs only to another target's internal implementation
- the current target has no real surface, contract, dependency, or responsibility for it
- including it would create a hollow feature with no meaningful target-specific content

For included cross-client features:

- reuse the shared `feature_id`
- rewrite `name`, `description`, and `acceptance` from the current target's perspective when necessary
- add target-specific surfaces such as pages, screens, roles, endpoints, or api calls

## Required Top-Level Completeness

At the top level, preserve or fill:

- `product_intent`
- `scope`
- `completeness`

These should clearly capture:

- user goal and value
- primary flow
- in-scope vs out-of-scope
- explicit non-goals
- happy paths, edge cases, and failure cases

## Target-Specific Rules

Use target-appropriate arrays and field names:

- backend/api: `endpoints`, `db_tables`
- website/web/frontend: `pages`, `api_calls`
- mobile/ios/android: `screens`, `api_calls`
- admin: `pages`, `roles`
- fallback targets: use the closest schema-compatible fields provided by the target contract

For HTTP/path style arrays, prefer simple string entries such as `GET /api/health` instead of object elements unless the target contract explicitly says otherwise.

Do not mix target-specific field families. For example, do not use frontend `pages` as a substitute for backend `endpoints`, and do not use backend infrastructure notes to stand in for mobile screen flows.

## Backend Rules

When the current target is backend or api:

- populate `tech_stack` carefully
- keep infrastructure fields explicit when known
- fill `features[].endpoints`
- fill `features[].db_tables` with `[]` when no tables apply
- preserve deployment-related API runtime hints when the current contract expects them

## Feature List Rules

Always create or update the matching `feature_list-<client_target>.md`.

Treat the feature list as a deterministic projection of the current target JSON, not as an independent freeform summary.

The feature list should be a concise Markdown table containing at least:

- `feature_id`
- name
- priority
- phase

When the format allows, keep it aligned with the JSON feature set and order. If extra columns are added, they should still be derived from the JSON rather than hand-authored narrative drift.

## Completeness Rules

At the target level, the finished PRD should be good enough for downstream review and implementation planning. Make sure it expresses:

- the target's role in the product
- the target-specific feature surface
- scope, non-goals, and completeness expectations
- target-specific acceptance and dependencies
- target-appropriate contract fields such as routes, screens, roles, api calls, endpoints, or db tables

Keep one main shared authoring lifecycle across all targets. Do not invent a new skill split per client inside this skill. If a target has unusually strong local rules, express them as target-specific constraints while preserving the shared authoring contract.

## Review Loop

Before finishing, run a target completeness review loop and keep fixing until it passes.

Check:

- only the current target's files changed
- the target contains exactly the features it should own from the shared PRD, without obvious omissions or hollow extras
- `features[]` is non-empty
- every feature has a valid `feature_id`
- required target-specific fields are present
- acceptance criteria are concrete and testable
- conflicting stale fields were corrected instead of blindly preserved
- the feature list matches the PRD JSON
- target-specific descriptions and acceptance reflect the current target perspective rather than a copied shared summary

Before finishing, verify:

- only the current target's files changed
- `features[]` is non-empty
- every feature has a valid `feature_id`
- required target-specific fields are present
- acceptance criteria are concrete and testable
- the feature list matches the PRD JSON
- top-level `product_intent`, `scope`, and `completeness` stay aligned with the shared PRD while remaining meaningful for the current target

## Final Response

Briefly report:

- which target was updated
- which files were written
- any assumptions about the target schema, inherited feature IDs, or target projection choices
