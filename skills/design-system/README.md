# design-system

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`design-system` is an Agent Skill for PiFlow projects that need a project-level design system during the `design` stage, especially when the team wants to use OpenDesign as the built-in primary design-system library and derive reusable UI rules from its packs, plus screenshots, existing products, or brand direction when needed.

Instead of treating an external template as the final answer, this skill helps the agent normalize references into a project-owned design-system contract that later `design` roles, `design-review`, and `codegen` can consume consistently.

## Core Behavior

- Position design-system work as a dedicated `design`-stage role.
- Use OpenDesign as the default built-in reference library.
- Select one primary visual reference and a small backup set when needed.
- Normalize external references into internal tokens, layout rules, component principles, interaction rules, and guardrails.
- Allow fallback reference sources when OpenDesign coverage is insufficient.
- Separate shared cross-surface rules from surface-specific variants.
- Produce outputs that are usable by both humans and downstream agents.
- Keep later page or feature design aligned to one system instead of drifting per screen.

## Install

From the repository root:

```bash
node install.mjs design-system
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs design-system --dry-run
node ../install.mjs design-system --only codex
node ../install.mjs design-system --only cursor
node ../install.mjs design-system --only claude
node ../install.mjs design-system --copy
```

## Usage

Ask an agent to build a PiFlow design-system plan from brand direction and references:

```text
Use $design-system to search OpenDesign first, choose a primary pack, and turn this PRD plus the chosen references into a project-level design system for the PiFlow design stage.
```

Chinese invocation:

```text
使用 design-system，根据 PRD 和 OpenDesign 参考，为 PiFlow 的 design 阶段整理一份项目级设计系统。
```

You can also ask it to define the pipeline role and units:

```text
Use design-system to propose the role, units, and review checkpoints for introducing a design system into PiFlow.
```

Use the bundled helper directly:

```bash
node skills/design-system/scripts/opendesign-design-system.mjs --slug vercel
node skills/design-system/scripts/opendesign-design-system.mjs --query "developer tool saas" --format markdown
node skills/design-system/scripts/opendesign-design-system.mjs --query fintech --output /tmp/design-system.json
```

The helper output includes a `piflow_artifact` block that maps directly to PiFlow feature design usage, especially `implementation_spec.ui_ue_spec.visual_constraints`.

## Reference Policy

- OpenDesign is the built-in primary library for this skill.
- The agent should search OpenDesign first unless the user explicitly asks for another source.
- Other sources remain allowed as fallback or extension inputs when OpenDesign does not cover the needed product type, platform pattern, or interaction style well enough.
- The normalized PiFlow design-system output remains the final project-owned source of truth.

## Files

- `SKILL.md`: trigger rules, PiFlow role positioning, workflow, OpenDesign integration rules, and review checklist.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `scripts/opendesign-design-system.mjs`: fetch and normalize OpenDesign packs into a PiFlow design-system draft, including `piflow_artifact.visual_constraints_template`.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
