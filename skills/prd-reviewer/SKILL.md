---
name: prd-reviewer
description: Use when a PiFlow project needs to review one per-client PRD output and produce canonical `output-stages/prd-review/prd-review-<client_target>.json` review results, especially before entering design, when the reviewer must decide blocking issues, feature phase/disposition, implementation readiness, and possible clarification questions from `prd-spec.md`, `prd-<client_target>.json`, and the matching feature list.
---

# Prd Reviewer

## Overview

Review one PiFlow per-client PRD output and produce the canonical per-target PRD review JSON.

This skill is for PRD review work, not PRD authoring. It should evaluate readiness for design, call out concrete blocking issues, and keep the output structured enough for downstream merge logic.

## When To Use

Use this skill when:

- the workflow is in PiFlow `prd-review` stage
- one client target needs review output
- the required output is `output-stages/prd-review/prd-review-<client_target>.json`
- the job is to judge scope clarity, feature decomposition, edge/failure coverage, and implementation readiness

Do not use this skill for:

- editing `prd-spec.md`
- editing `prd-*.json`
- merging all targets into one global review artifact yourself

## Inputs

Read, when available:

- `output-stages/prd/prd-spec.md`
- the current target PRD JSON such as `output-stages/prd/prd-backend.json`
- `output-stages/prd/feature_list-<client_target>.md`
- current feature references mirrored from the PRD stage when available

## Required Output

Write only:

- `output-stages/prd-review/prd-review-<client_target>.json`

Do not write explanatory Markdown unless the caller explicitly asks.

## Review Goals

Evaluate whether the current target PRD is ready to enter design.

Focus on:

- target responsibility clarity
- feature decomposition quality
- acceptance criteria testability
- phase/disposition correctness
- cross-target dependency clarity
- scope and non-goals discipline
- edge cases and failure cases
- implementation readiness

## Output Structure

The review JSON should preserve a structure compatible with PiFlow review merging. Include, when applicable:

- `client_target`
- `review.summary`
- `review.feature_assessments`
- `review.deferred_features`
- `review.blocking_issues`
- `review.suggested_prd_spec_changes`
- `review.scores`
- `review.blocking_gaps`
- `review.recommendations`
- `outputs.decision`

## Decision Rules

- If the target is ready, set decision to pass and keep blocking issues empty.
- If the target is not ready, blocking issues must cite concrete evidence such as feature IDs, missing fields, contradictory scope, or absent edge/failure coverage.
- Prefer non-blocking recommendations for polish, wording, or detail-level improvements that do not prevent design/codegen.

## Feature Assessment Rules

For each reviewed feature:

- emit one `feature_assessments` entry
- preserve the feature's actual `feature_id`
- choose a clear disposition such as include or defer
- include a phase when the workflow expects phase-aware output
- explain why the feature is included, deferred, or blocked

## Clarification Rules

If review findings reveal unanswered product questions:

- surface them as concrete clarification candidates
- keep them specific and answerable
- distinguish them from blocking issues caused by already-known contradictions

Do not invent user answers.

## Scoring Rules

Where scoring is expected, use consistent numeric scoring for:

- scope clarity
- user value clarity
- feature decomposition
- edge case coverage
- implementation readiness

Scores must reflect the actual written PRD, not optimistic assumptions.

## Quality Check

Before finishing, verify:

- only the canonical review JSON was written
- each reviewed feature has a corresponding assessment
- blocking issues are evidence-based
- pass decisions do not contain unresolved blockers
- recommendations are separated from blockers

## Final Response

Briefly report:

- which target was reviewed
- where the review JSON was written
- whether the result is ready, blocked, or needs clarification
