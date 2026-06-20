---
name: prd-client-author
description: Use when a PiFlow project needs to create, regenerate, or refine one per-client PRD artifact such as `output-stages/prd/prd-website.json`, `prd-admin.json`, `prd-backend.json`, or `prd-mobile.json` plus the matching `feature_list-<client_target>.md`, especially when the workflow injects a single `client_target`, schema expectations, and the shared source document `output-stages/prd/prd-spec.md`.
---

# Prd Client Author

## Overview

Generate or refine one PiFlow per-client PRD JSON plus its feature list.

This skill is for PRD stage Agent-B style work. It consumes the shared `prd-spec.md`, focuses on one `client_target`, and writes only that target's artifacts.

## When To Use

Use this skill when:

- the workflow is generating one `prd-*.json` file for a single client target
- the target is `website`, `admin`, `backend`, `mobile`, `desktop`, `miniapp`, or a mapped alias
- the caller provides or implies a canonical target file and schema
- the job is to incrementally fill a per-client PRD, not to review it

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

## Allowed Outputs

Write only the current target's files:

- `output-stages/prd/prd-<target>.json`
- `output-stages/prd/feature_list-<client_target>.md`

Do not modify other targets' PRD files.

## Authoring Rules

1. Only edit the current target.
2. Preserve existing non-empty fields where possible.
3. Add missing fields, missing features, missing acceptance criteria, and missing top-level metadata incrementally.
4. Keep the document in Chinese unless the project explicitly uses another language.
5. Every feature must include:
   - `feature_id`
   - `name`
   - `priority`
   - `phase`
   - `description`
   - non-empty `acceptance`
6. Cross-client features must keep the exact same `feature_id` as the shared PRD source.

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

## Backend Rules

When the current target is backend or api:

- populate `tech_stack` carefully
- keep infrastructure fields explicit when known
- fill `features[].endpoints`
- fill `features[].db_tables` with `[]` when no tables apply
- preserve deployment-related API runtime hints when the current contract expects them

## Feature List Rules

Always create or update the matching `feature_list-<client_target>.md`.

The feature list should be a concise Markdown table containing at least:

- `feature_id`
- name
- priority
- phase

## Quality Check

Before finishing, verify:

- only the current target's files changed
- `features[]` is non-empty
- every feature has a valid `feature_id`
- required target-specific fields are present
- acceptance criteria are concrete and testable
- the feature list matches the PRD JSON

## Final Response

Briefly report:

- which target was updated
- which files were written
- any assumptions about the target schema or inherited feature IDs
