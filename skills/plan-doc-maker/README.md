# plan-doc-maker

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`plan-doc-maker` is an Agent Skill for generating reviewed Chinese proposal, solution, architecture, implementation, migration, refactor, or upgrade plan documents under project-local `docs/plans/`.

It also maintains `docs/plans/plan_index.md`, a project-level deduplicated execution index that consolidates active modification points across all plan documents in the same project.

## Core Behavior

- Locate the correct target project before writing plans.
- Generate plan documents named `<yyyymmdd-HHmm>-<proposal>.md`.
- Review and revise each plan until it passes.
- Maintain `docs/plans/plan_index.md`.
- Merge overlapping changes from multiple source plans into one modification point.
- Preserve all source document references on merged modification points.
- Resolve conflicting plan designs using reasonableness, correctness, consistency, compatibility, risk, safety, and testability.
- Ask the user to choose when a high-impact conflict cannot be resolved from evidence, with pros, cons, risks, and a recommendation.

## Install

From the repository root:

```bash
node install.mjs plan-doc-maker
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs plan-doc-maker --dry-run
node ../install.mjs plan-doc-maker --only codex
node ../install.mjs plan-doc-maker --only cursor
node ../install.mjs plan-doc-maker --only claude
node ../install.mjs plan-doc-maker --copy
```

## Usage

Generate a new reviewed plan:

```text
Use $plan-doc-maker to create an authentication upgrade plan under docs/plans/ and review it until it passes.
```

Chinese invocation:

```text
使用 plan-doc-maker，生成一个认证升级技术方案，写入 docs/plans/ 并评审到通过。
```

Maintain or consolidate existing plans:

```text
使用 plan-doc-maker，整合当前项目 docs/plans/ 下的方案并维护 plan_index.md。
```

## Files

- `SKILL.md`: trigger rules, plan generation workflow, review criteria, `plan_index.md` rules, and final response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `assets/plan-template.md`: bundled plan template.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
