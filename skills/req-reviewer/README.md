# req-reviewer

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`req-reviewer` is an Agent Skill for reviewing and revising existing Chinese requirement documents, especially `inputs/req.md`.

It checks source coverage, template format, quality, consistency, `feature_id` rules, multi-client contracts, compatibility, and testability. It then revises the document directly and repeats review loops until the requirements pass and are marked `已评审`.

## Core Behavior

- Locate the target project and requirement file.
- Load the PiFlow requirement template when available.
- Back up `inputs/req.md` before the first write.
- Review source coverage and requirement quality.
- Validate feature IDs, priorities, phases, client targets, dependencies, test cases, auth, deployment, and technical constraints.
- Revise the requirement document directly.
- Repeat review and revision until there are no material findings.
- Commit and push only the requirement document, backup, and directly related review artifacts when applicable.

## Install

From the repository root:

```bash
node install.mjs req-reviewer
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs req-reviewer --dry-run
node ../install.mjs req-reviewer --only codex
node ../install.mjs req-reviewer --only cursor
node ../install.mjs req-reviewer --only claude
node ../install.mjs req-reviewer --copy
```

## Usage

```text
Use $req-reviewer to review inputs/req.md, revise it until it passes, and mark it as 已评审.
```

```text
使用 req-reviewer，评审 inputs/req.md，修订到通过并标记为已评审。
```

## Files

- `SKILL.md`: trigger rules, review workflow, metadata rules, review criteria, and final response contract.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `agents/openai.yaml`: OpenAI/Codex display metadata and default prompt.
