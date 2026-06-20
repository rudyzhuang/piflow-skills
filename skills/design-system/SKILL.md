---
name: design-system
description: Use when a PiFlow project needs a project-level design system during the design stage, especially when the user wants to use OpenDesign as the default primary design-system library and turn its references, plus any fallback visual sources, into reusable tokens, layout principles, component rules, interaction rules, and reviewable design constraints for later design roles and code generation.
---

# Design System

## Overview

Create a project-level design system for the PiFlow `design` stage. This skill uses OpenDesign as the built-in primary reference design-system library, then turns selected packs plus any approved fallback references into a normalized internal design-system output that later design roles, design-review, and codegen can consume consistently.

This skill is for global design rules, not for drawing one page in isolation. Treat it as a `design` stage role that defines the common visual language for the rest of the project.

## When To Use

Use this skill when any of the following is true:

- The user wants to introduce or formalize a design system in PiFlow.
- The user wants to reference or reuse OpenDesign templates or packs.
- The project needs one default built-in visual reference library instead of ad hoc reference hunting.
- A project has multiple frontend surfaces such as website, admin, mobile, desktop, or miniapp and needs one consistent visual baseline.
- The user asks to define project-wide tokens, layout rules, component principles, or UI guardrails before detailed page design.
- Later design roles are drifting because there is no shared style source.
- Code generation would benefit from one stable, machine-readable design contract instead of ad hoc visual instructions.

Do not use this skill for:

- A single isolated page revision with no project-wide implications.
- Pure logo or brand naming work with no UI system implications.
- Final code implementation by itself.

## Role Position In PiFlow

Treat this skill as a `design` stage role, usually named `design-system`.

Recommended pipeline position:

1. `prd` defines product goals, target users, brand tone, and preferred visual direction.
2. `design-system` translates those signals plus external references into a project-level design system.
3. Other `design` roles create feature, page, or flow designs using that system.
4. `design-review` checks both the system itself and whether downstream designs follow it.
5. `codegen` consumes the normalized design system plus feature-level design outputs.

OpenDesign is the default primary library for reference discovery, but it is still not the final source of truth. The project-owned normalized design system is the source of truth.

## Inputs

Gather as many of these as are available:

- PiFlow `prd` outputs, product notes, or requirement documents
- Product type, user segment, and release scope
- Brand tone, positioning, and explicit visual constraints
- Existing product UI, screenshots, or design links
- OpenDesign references such as `catalog.json`, `DESIGN_SPEC.*.md`, `DESIGN.md`, or `spec.json`
- Chosen primary and backup reference sites or packs
- Optional fallback libraries or internal product references when OpenDesign coverage is insufficient
- Platform scope such as `website`, `admin`, `mobile`, `desktop`, `miniapp`

If the user names only a broad aesthetic direction, infer a small candidate set of references and state the assumption.

## Outputs

Produce two levels of output whenever the task includes file generation or formal design-stage artifacts:

1. A human-readable design-system summary
2. A structured machine-readable design-system payload

The output should cover at least:

- Identity and design intent
- Reference sources and selection rationale
- Color tokens
- Typography tokens
- Spacing and density rules
- Surfaces such as radius, borders, shadows
- Layout rules such as containers, grids, breakpoints, shells
- Component principles
- Interaction and motion rules
- Content tone and UI copy rules
- Accessibility and consistency constraints when known
- Explicit don’ts and guardrails

When possible, also emit a PiFlow-facing artifact envelope that downstream feature design can reference, especially:

- `artifact_id`
- suggested `output_path`
- `visual_constraints_template.design_system_refs[]`
- `visual_constraints_template.component_refs[]`
- `visual_constraints_template.tokens[]`
- `visual_constraints_template.avoid_patterns[]`

When PiFlow needs downstream planning, also provide recommended `role` and `unit` splits for later design work.

When a shell is available, prefer using this skill's helper script for OpenDesign ingestion:

```bash
node scripts/opendesign-design-system.mjs --slug vercel
node scripts/opendesign-design-system.mjs --query "developer tool saas" --format markdown
```

## Recommended Role And Unit Structure

When the user asks how to organize the design-system work in PiFlow, recommend:

- `stage`: `design`
- `role`: `design-system`

Recommended units:

- `reference-selection`
- `token-definition`
- `layout-principles`
- `component-principles`
- `interaction-principles`
- `content-style`
- `design-guardrails`

Use units to break the work into reviewable, independent slices. Do not split by page unless the user explicitly asks for a page-first approach.

## Reference Source Policy

Use this source priority unless the user explicitly requests otherwise:

1. OpenDesign as the built-in primary reference design-system library
2. Existing first-party product UI, screenshots, or internal design assets
3. Other approved external references only when OpenDesign does not cover the product type, platform pattern, or interaction style well enough

If OpenDesign is bypassed, explain why. Good reasons include:

- no suitable product category match
- missing platform-specific patterns
- insufficient component detail for the required surface
- direct conflict with project brand constraints

## Workflow

### 1. Clarify the design target

Determine:

- What kind of product this is
- Which client targets are in scope
- Whether the product needs one shared system or controlled variants per surface
- Whether the design direction should feel more like SaaS, developer tools, editorial, commerce, enterprise, or consumer product

Keep the result short and decision-oriented.

### 2. Select references

Start from OpenDesign by default:

- Search `catalog.json` first.
- Prefer one primary OpenDesign pack and at most one or two backups.
- Select references by product fit, density, tone, interaction style, and component maturity.
- Avoid mixing unrelated references unless you can explain the boundary clearly, such as one reference for typography and another for dashboard tables.
- Expand to other sources only when OpenDesign cannot reasonably cover the need.

Capture:

- `primary_reference`
- `backup_references`
- `selection_rationale`
- `rejected_references` when useful
- `fallback_source_reason` when a non-OpenDesign source is selected

### 3. Normalize the references into a project-owned system

Do not copy the external reference blindly. Translate it into the project's own rules:

- Which parts are adopted directly
- Which parts are softened or strengthened
- Which parts are excluded because they conflict with the product, audience, or multi-platform needs

The normalized result should be stable enough that downstream designers or agents no longer need to read the original reference to make ordinary decisions.

### 4. Define foundations

Specify at minimum:

- Colors
- Typography
- Spacing
- Radius, borders, shadows
- Breakpoints and layout width rules
- Motion timing and interaction feedback principles

Prefer reusable tokens and principles over one-off values.

### 5. Define system-level patterns

Describe the shared behavior of:

- Navigation shells
- Page headers
- Section rhythm
- Cards and panels
- Forms and tables
- Lists, detail views, empty states, loading states, error states
- CTA hierarchy

Make clear what is globally consistent versus what may vary by surface.

### 6. Define voice and guardrails

Write explicit rules for:

- Headline style
- CTA wording style
- Helper text tone
- Empty-state tone
- Visual and interaction don’ts

Guardrails are required. A design system without explicit exclusions is too vague for reliable downstream use.

### 7. Map the system to downstream PiFlow work

For each later design role or feature cluster, explain which parts of the system it must inherit:

- page shell
- navigation
- component set
- density
- motion level
- content tone

If the user is designing multiple surfaces, state where shared rules end and where surface-specific variants begin.

### 8. Review the result

Run a review before declaring the design system complete.

Check:

- Is it coherent rather than a collage of references?
- Is it specific enough for later design roles and codegen?
- Does it separate shared rules from per-surface variants?
- Are the guardrails explicit?
- Are there any obvious contradictions between tone, density, and component rules?

Revise until the system is usable as a project-level contract.

## OpenDesign Integration Rules

OpenDesign is the built-in primary design-system library for this skill.

Use it in this order:

1. Search `catalog.json` to find candidate packs by product type, tone, tags, or summary.
2. Read the chosen pack's `DESIGN_SPEC.*.md` to understand the human-readable system intent.
3. Read `spec.json` to extract structured tokens and system primitives.
4. Use `DESIGN.md` only as a compatibility layer when a Google Stitch style design passport is useful.
5. Normalize the extracted material into PiFlow-owned terminology and outputs.

When a shell is available, prefer this helper script instead of reimplementing catalog lookup by hand:

```bash
node scripts/opendesign-design-system.mjs --slug <slug>
node scripts/opendesign-design-system.mjs --query "<keywords>" --output /tmp/design-system.json
```

The helper script:

- fetches `catalog.json`
- ranks or resolves candidate packs
- fetches `DESIGN_SPEC.*.md`, `spec.json`, and `DESIGN.md`
- emits a PiFlow-oriented design-system draft in JSON or Markdown
- includes a `piflow_artifact` block designed to feed `implementation_spec.ui_ue_spec.visual_constraints`

When using OpenDesign:

- Treat it as the default reference source, not final project ownership.
- Prefer its structured assets when available, such as `spec.json` and `DESIGN_SPEC.*.md`.
- Preserve the reasoning for why a reference was chosen.
- Normalize the extracted rules into PiFlow terminology and downstream roles.
- Avoid using many primary references at once.

When using fallback sources:

- Keep OpenDesign as the first comparison point unless the user forbids it.
- Use fallback sources to fill gaps, not to erase the normalization contract.
- Record exactly which rules came from fallback sources when that distinction matters.

If the user wants to "directly use a template", first evaluate whether that template can serve all required surfaces. If not, extract the system principles and rebuild the project-owned system instead of copying page shapes verbatim.

## Review Checklist

Before completion, verify:

- The design system clearly belongs in the `design` stage, not `prd` or `codegen`
- The chosen references match the product category and tone
- OpenDesign was considered first unless there is a documented reason not to
- Foundations are explicit and reusable
- Shared rules versus surface-specific variants are clear
- Components and states are addressed, not just colors and typography
- Motion and interaction are covered when relevant
- Guardrails and don’ts are present
- Downstream design roles and codegen could use the result without reinterpreting the source references from scratch

## Final Response Contract

When using this skill to produce an answer or document, the final response should briefly cover:

- The chosen design direction
- The primary and backup references
- The normalized system structure
- Recommended PiFlow `role` and `unit` split
- Any important risks, such as overfitting to one template or mixing incompatible references
