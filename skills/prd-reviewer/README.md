# prd-reviewer

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`prd-reviewer` is an Agent Skill for reviewing one PiFlow per-client PRD output and producing the canonical `output-stages/prd-review/prd-review-<client_target>.json` result.

It is designed for the PRD review stage:

- read `prd-spec.md`, one target PRD JSON, and the matching feature list
- assess scope clarity, feature decomposition, acceptance quality, edge/failure coverage, and implementation readiness
- require evidence-backed blockers instead of subjective gate decisions
- check consistency across shared PRD, target PRD, feature list, and mirrored feature references
- run a review self-check before finishing
- emit structured blocking issues, recommendations, feature assessments, and review scores
- keep the result ready for downstream PiFlow review merging

## Install

From the repository root:

```bash
node install.mjs prd-reviewer
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs prd-reviewer --dry-run
node ../install.mjs prd-reviewer --only codex
node ../install.mjs prd-reviewer --only cursor
node ../install.mjs prd-reviewer --only claude
node ../install.mjs prd-reviewer --copy
```

## Usage

```text
Use $prd-reviewer to review the backend PRD, cite concrete evidence for blockers, separate recommendations from gate failures, and write output-stages/prd-review/prd-review-backend.json.
```

```text
使用 prd-reviewer，评审当前端 PRD，输出带证据的 canonical prd-review-<client_target>.json，不要改 PRD 正文。
```

## Files

- `SKILL.md`: trigger rules, review criteria, output structure, and final response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
