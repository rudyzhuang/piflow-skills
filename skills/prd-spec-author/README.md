# prd-spec-author

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`prd-spec-author` is an Agent Skill for writing the shared PiFlow PRD source document `output-stages/prd/prd-spec.md` from structured requirement truth such as `output-stages/setup/canonical-req.json` or `inputs/req.yaml`.

It is designed for the PRD stage's Agent-A role:

- preserve existing non-empty PRD sections
- fill missing or placeholder content incrementally
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
Use $prd-spec-author to regenerate output-stages/prd/prd-spec.md from inputs/req.yaml without overwriting existing non-empty sections.
```

```text
使用 prd-spec-author，根据 canonical req 增量补全 output-stages/prd/prd-spec.md，保留已有非空内容。
```

## Files

- `SKILL.md`: trigger rules, editing scope, PRD authoring rules, and output contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
