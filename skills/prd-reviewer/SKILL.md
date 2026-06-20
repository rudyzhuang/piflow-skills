---
name: prd-reviewer
description: Use when a PiFlow project needs to review one per-client PRD output and produce canonical `output-stages/prd-review/prd-review-<client_target>.json` review results, especially before entering design, when the reviewer must make evidence-based gate decisions, separate blockers from recommendations, check consistency across `prd-spec.md`, `prd-<client_target>.json`, feature lists, and mirrored feature references, and surface clarification or PRD-spec feedback without rewriting the PRD itself.
---

# Prd Reviewer

## Overview

Review one PiFlow per-client PRD output and produce the canonical per-target PRD review JSON.

This skill is for PRD review work, not PRD authoring. It should behave like an evidence-based PRD gate reviewer: evaluate whether the written PRD is ready to enter design, call out concrete blocking issues with cited evidence, distinguish blockers from recommendations and clarification needs, and keep the output structured enough for downstream merge logic.

## When To Use

Use this skill when:

- the workflow is in PiFlow `prd-review` stage
- one client target needs review output
- the required output is `output-stages/prd-review/prd-review-<client_target>.json`
- the job is to judge scope clarity, feature decomposition, edge/failure coverage, implementation readiness, and whether design/codegen would be blocked or misled by the current PRD

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

Treat these as review evidence, not editing targets. The reviewer is allowed to reason across them, but must only write the canonical review JSON.

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

The key question is not whether the PRD is perfect. The key question is whether downstream design/codegen can proceed without being blocked, mis-scoped, or pushed into the wrong implementation.

## Evidence Matrix

For each feature assessment, actively gather and compare evidence from the sources that are visible in the stage:

- shared PRD evidence:
  - whether `prd-spec.md` defines the feature's business intent, scope, and cross-target relationship
- client PRD evidence:
  - whether the current target PRD contains the feature and enough target-specific contract detail
- feature list evidence:
  - whether `feature_list-<client_target>.md` matches the current target JSON
- mirrored feature reference evidence:
  - whether stage-level feature references or aggregated feature lists still align with the target feature set when those references are available
- readiness evidence:
  - whether acceptance, dependencies, edge/failure behavior, auth, route/page/screen/API/deploy details, and target-specific contract fields are sufficient for downstream work

When evidence is missing or contradictory, say so explicitly in the review output. Do not hide missing evidence behind optimistic assumptions.

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

Keep the structure schema-compatible, but strengthen the content:

- `review.summary` should state whether the target is ready and identify the highest-risk gaps
- `review.feature_assessments[]` should cite evidence and explain the disposition
- `review.blocking_issues[]` should say what is blocked and why
- `review.suggested_prd_spec_changes[]` should be reserved for shared-spec-level fixes
- `review.recommendations[]` should stay non-blocking
- `review.blocking_gaps[]` should categorize concrete readiness gaps when the schema supports it

## Decision Rules

- If the target is ready, set decision to pass and keep blocking issues empty.
- If the target is not ready, blocking issues must cite concrete evidence such as feature IDs, missing fields, contradictory scope, or absent edge/failure coverage.
- Prefer non-blocking recommendations for polish, wording, or detail-level improvements that do not prevent design/codegen.

Only block when the gap would cause downstream design/codegen to stall, misinterpret scope, or produce the wrong implementation. Do not promote ordinary polish suggestions into blockers.

## Classification Rules

Classify findings using the following boundary:

- blocking issue:
  - the current PRD is missing or contradicting information that design/codegen needs in order to proceed correctly
  - examples include missing acceptance, unresolved auth/role boundaries, missing route/API/screen contract, contradictory cross-target meaning, or absent failure semantics that change implementation shape
- clarification:
  - a real product or scope decision is missing and cannot be responsibly inferred by the reviewer
- suggested PRD spec change:
  - the problem originates in the shared `prd-spec.md` contract and should be corrected upstream rather than disguised as a per-target patch
- recommendation:
  - the PRD could be improved, but downstream work can still proceed correctly without resolving it now

If the existing schema does not expose a separate clarification field, phrase the clarification need in the supported field that best preserves the user's unanswered decision without pretending it is already resolved.

## Feature Assessment Rules

For each reviewed feature:

- emit one `feature_assessments` entry
- preserve the feature's actual `feature_id`
- choose a clear disposition such as include or defer
- include a phase when the workflow expects phase-aware output
- explain why the feature is included, deferred, or blocked
- cite the concrete evidence used for the conclusion

Each current-target visible feature should be assessed exactly once. If a feature is deferred, explain the defer reason, the impact, and what would need to change for it to re-enter scope.

## Clarification Rules

If review findings reveal unanswered product questions:

- surface them as concrete clarification candidates
- keep them specific and answerable
- distinguish them from blocking issues caused by already-known contradictions

Do not invent user answers.

If a clarification is required for pass/fail, say what decision is missing and which feature or target behavior depends on it.

## Consistency Rules

Actively check consistency across:

- `prd-spec.md`
- the current target `prd-<client_target>.json`
- `feature_list-<client_target>.md`
- mirrored or aggregated feature references when available

Look for:

- missing features
- extra features that the target should not own
- feature meaning drift
- mismatched phase or disposition expectations
- feature list drift from JSON
- contradictions between shared PRD and target PRD that would confuse downstream implementation

Do not assume the current target JSON is correct just because it is structured. Cross-check it.

## Target-Specific Checklist

Review with target-appropriate depth:

- website:
  - pages, routes, API calls, auth states, loading/error behavior, deployment path or URL assumptions
- admin:
  - roles, permissions, auditability, sensitive action handling, ProLayout or shell assumptions, default `/projects` landing expectations when applicable
- backend:
  - endpoint method/path semantics, auth, error semantics, db/resource dependencies, deploy/runtime hints, smoke-path feasibility
- mobile:
  - screens, API calls, weak network behavior, permission denial, platform differences, offline/failure semantics, non-MVP native capabilities that should defer
- fallback targets:
  - interaction surface, dependency contract, acceptance quality, failure semantics, and scope discipline

## Scoring Rules

Where scoring is expected, use consistent numeric scoring for:

- scope clarity
- user value clarity
- feature decomposition
- edge case coverage
- implementation readiness

Scores must reflect the actual written PRD, not optimistic assumptions.

## Self-Check Loop

Before writing the final JSON, run an adversarial self-check on your own review output:

- completeness:
  - every visible feature has an assessment
- consistency:
  - summary, decision, blockers, deferred features, recommendations, and scores do not contradict each other
- clarity:
  - each blocker or clarification is concrete enough for the upstream author to act on
- scope:
  - non-blocking issues were not mislabeled as blockers
- feasibility:
  - pass really means the target can enter design/codegen without hidden blockers

If the self-check finds a weak conclusion, revise the review output before finishing.

## Quality Check

Before finishing, verify:

- only the canonical review JSON was written
- each reviewed feature has a corresponding assessment
- blocking issues are evidence-based
- pass decisions do not contain unresolved blockers
- recommendations are separated from blockers
- shared-spec problems are routed into `suggested_prd_spec_changes` instead of being blurred into generic target feedback
- feature list drift or cross-artifact inconsistencies were checked explicitly

## Final Response

Briefly report:

- which target was reviewed
- where the review JSON was written
- whether the result is ready, blocked, or needs clarification
- the highest-signal blocking reason if the review failed
