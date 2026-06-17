# req-maker

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`req-maker` is an Agent Skill for turning product notes, specs, screenshots, Figma Make `.make` bundles, or PiFlow `req-md-export` data into a reviewed Chinese `inputs/req.md`.

It supports two main modes:

- Draft mode: extract requirements from user-provided source material, write `inputs/req.md`, then run source-coverage and quality review loops until the document passes.
- Export mode: render Backend `req-md-export` JSON or Markdown into `inputs/req.md` while preserving traceability fields such as `requirement_id`, `item_id`, `source_item_id`, `version_number`, `version_hash`, and `version_status`.

## Install

From the repository root:

```bash
node install.mjs req-maker
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
python3 install.py
```

Useful installer options:

```bash
node ../install.mjs req-maker --dry-run
node ../install.mjs req-maker --only codex
node ../install.mjs req-maker --only cursor
node ../install.mjs req-maker --only claude
node ../install.mjs req-maker --copy
```

## Usage

Ask an agent to generate or export requirements:

```text
Use $req-maker to turn my product notes into inputs/req.md and review it until it passes.
```

```text
使用 req-maker，根据下面的产品想法生成 inputs/req.md，并评审到通过。
```

For Backend exports, the helper can render a local export file:

```bash
node scripts/export-req-md.mjs \
  --input /path/to/req-md-export.json \
  --output /path/to/project/inputs/req.md
```

Or request the Backend directly:

```bash
node scripts/export-req-md.mjs \
  --api-base-url https://piflow.org/api/v1 \
  --project-id project_uuid \
  --device-api-key "$DEVICE_API_KEY" \
  --workspace-root /Users/name/piflow-projects
```

## Files

- `SKILL.md`: trigger rules, workflow, review requirements, and final response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs` / `install.py`: compatibility wrappers for the root installer.
- `assets/req-template.md`: bundled PiFlow requirement template.
- `scripts/export-req-md.mjs`: render or fetch Backend requirement exports.
- `scripts/figma-make-summary.mjs`: summarize local Figma Make bundles.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
