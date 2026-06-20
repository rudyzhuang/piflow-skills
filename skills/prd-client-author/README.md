# prd-client-author

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`prd-client-author` is an Agent Skill for generating one PiFlow per-client PRD JSON file such as `prd-website.json`, `prd-admin.json`, `prd-backend.json`, or `prd-mobile.json`, plus the matching `feature_list-<client_target>.md`.

It is designed for the PRD stage's Agent-B role:

- read the shared `output-stages/prd/prd-spec.md`
- focus on one `client_target`
- preserve valid existing target fields
- correct stale target fields that conflict with the shared PRD
- project shared features into target-specific contracts
- run a target completeness review before finishing
- fill target-specific feature, scope, completeness, and contract details
- keep feature IDs aligned with the shared PRD source

## Install

From the repository root:

```bash
node install.mjs prd-client-author
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs prd-client-author --dry-run
node ../install.mjs prd-client-author --only codex
node ../install.mjs prd-client-author --only cursor
node ../install.mjs prd-client-author --only claude
node ../install.mjs prd-client-author --copy
```

## Usage

```text
Use $prd-client-author to update output-stages/prd/prd-backend.json for the backend target, project the shared PRD into backend-specific contracts, and refresh feature_list-backend.md.
```

```text
使用 prd-client-author，只修改当前端产物，把 shared PRD 投影成该端合同，修正过期字段并同步 feature_list。
```

## Files

- `SKILL.md`: trigger rules, per-target authoring rules, and output contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
