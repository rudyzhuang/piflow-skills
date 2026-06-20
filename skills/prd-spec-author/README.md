# prd-spec-author

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`prd-spec-author` is an Agent Skill for writing the shared PiFlow PRD source document `output-stages/prd/prd-spec.md` from structured requirement truth such as `output-stages/setup/canonical-req.json` or `inputs/req.yaml`.

It is designed for the PRD stage's Agent-A role:

- preserve valid existing PRD sections
- correct stale content that conflicts with requirement truth
- fill missing or placeholder content incrementally
- run source coverage and shared-spec quality review loops before finishing
- keep client targets, feature IDs, scope, non-goals, completeness, and deployment architecture aligned
- produce a stable source document for downstream per-client PRD generation

## Install

From the repository root:

```bash
node install.mjs prd-spec-author
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs prd-spec-author --dry-run
node ../install.mjs prd-spec-author --only codex
node ../install.mjs prd-spec-author --only cursor
node ../install.mjs prd-spec-author --only claude
node ../install.mjs prd-spec-author --copy
```

## Usage

```text
Use $prd-spec-author to regenerate output-stages/prd/prd-spec.md from inputs/req.yaml, preserve valid content, correct requirement conflicts, and run coverage/quality checks before finishing.
```

```text
使用 prd-spec-author，根据 canonical req 修订 output-stages/prd/prd-spec.md，保留有效内容、纠正与真源冲突的旧内容，并完成覆盖与质量自检。
```

## Files

- `SKILL.md`: trigger rules, editing scope, PRD authoring rules, and output contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
