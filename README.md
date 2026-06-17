# piflow-skills

Personal Agent Skills for Cursor, Codex, OpenCode, and Claude Code.

This repository keeps multiple skills in one place and uses a single root
installer, `install.mjs`, to install or sync them into local agent skill
directories. Installable skills live under `skills/<skill-name>/`.

For the Chinese version of this document, see [README.zh-CN.md](./README.zh-CN.md).

## Current Skills

| Skill | Purpose | Main files |
| --- | --- | --- |
| `req-maker` | Extract project requirements from prompts, documents, specs, screenshots, Figma Make `.make` bundles, or PiFlow `req-md-export` data, then generate a Chinese PiFlow-style `inputs/req.md` with review loops. | `skills/req-maker/SKILL.md`, `skills/req-maker/assets/req-template.md`, `skills/req-maker/scripts/figma-make-summary.mjs`, `skills/req-maker/scripts/export-req-md.mjs` |
| `req-reviewer` | Review and revise existing Chinese requirements documents, especially `inputs/req.md`, until they pass source coverage, quality, consistency, feature ID, multi-client contract, compatibility, and testability checks. | `skills/req-reviewer/SKILL.md`, `skills/req-reviewer/agents/openai.yaml` |
| `plan-doc-maker` | Generate reviewed Chinese proposal, solution, architecture, implementation, migration, refactor, or upgrade plan documents under project-local `docs/plans/`, and maintain a deduplicated `plan_index.md` execution index. | `skills/plan-doc-maker/SKILL.md`, `skills/plan-doc-maker/assets/plan-template.md`, `skills/plan-doc-maker/agents/openai.yaml` |
| `plan-executor` | Execute user-provided plans, source plan documents, or `docs/plans/plan_index.md` items all the way through implementation, review, verification, status updates, commit, and push. | `skills/plan-executor/SKILL.md`, `skills/plan-executor/agents/openai.yaml` |
| `commit-push` | Turn "commit and push" into a repeatable Git workflow: inspect changes, derive commit intent, optionally bump versions, commit, push, and optionally create missing GitHub remotes. | `skills/commit-push/SKILL.md`, `skills/commit-push/scripts/commit_push.cjs`, `skills/commit-push/scripts/github_remote.cjs` |
| `piflow-status-inspector` | Read `output-stages/stages.json` from the current project and summarize PiFlow runtime status, stage progress, runtime, failures, recovery counts, and current stage task completion. | `skills/piflow-status-inspector/SKILL.md`, `skills/piflow-status-inspector/scripts/project_status.cjs`, `skills/piflow-status-inspector/agents/openai.yaml` |
| `add-skill-lib` | Add a Git-hosted skill library into the PiFlow pipeline repository by cloning it into `skill-libraries/repos/<library-name>`, writing metadata under `skill-libraries/libs/<library-name>`, registering it in `skill-libraries/libraries.yaml`, and exposing skills. | `skills/add-skill-lib/SKILL.md`, `skills/add-skill-lib/agents/openai.yaml` |

## Supported Agents

The installer detects and installs to these user-level skill directories:

| Agent | Install path |
| --- | --- |
| Cursor | `~/.cursor/skills/<skill-name>` |
| Codex | `~/.codex/skills/<skill-name>` |
| OpenCode | `~/.config/opencode/skills/<skill-name>` |
| Claude Code | `~/.claude/skills/<skill-name>` |

By default, the installer creates symlinks from the agent skill directory back
to this repository. That keeps one editable source copy. Re-run the installer
after moving this repository.

Before installing, an existing installed copy of the same skill is removed and
replaced with the current version.

Before installation, each selected skill is validated. Every installable skill
must include `SKILL.md`, `VERSION`, `CHANGELOG.md`, `README.md`,
`README.zh-CN.md`, and `install.mjs`.

When the Codex target is selected, the installer also installs this repository
as a local Codex plugin when `.codex-plugin/plugin.json` exists, updates the
personal marketplace entry, and runs `codex plugin add` if the `codex` command
is available.

## Install

Install all skills detected in this repository:

```bash
node install.mjs
```

Install one skill:

```bash
node install.mjs req-maker
node install.mjs --skill commit-push
```

Install multiple selected skills:

```bash
node install.mjs req-maker commit-push
node install.mjs --skill req-maker --skill req-reviewer
```

Preview without writing files:

```bash
node install.mjs --dry-run
node install.mjs req-maker --dry-run
```

Install only to one agent:

```bash
node install.mjs --only codex
node install.mjs req-maker --only cursor
node install.mjs req-maker --only opencode
node install.mjs commit-push --only claude
```

Install only to multiple selected agents:

```bash
node install.mjs req-maker --only codex --only opencode --only claude
```

Install to all known agent directories even if an agent is not detected:

```bash
node install.mjs --all
node install.mjs req-maker --all
```

Copy files instead of creating symlinks:

```bash
node install.mjs --copy
node install.mjs req-maker --copy
```

## Skill-local Wrappers

Each skill can still be installed from its own directory:

```bash
cd skills/req-maker
node install.mjs
```

Those local install scripts are compatibility wrappers. The shared installation
logic lives only in the repository root `install.mjs`.

For installing every skill, run the root installer from this directory:

```bash
node install.mjs --all-skills
```

## Use

After installation, ask the agent for the workflow you want. The agent should
select the matching skill from its description.

Examples:

```text
使用 req-maker，根据这些产品想法生成 inputs/req.md，并评审到通过。
```

```text
评审 inputs/req.md，修订到通过并标记为已评审。
```

```text
生成一个认证升级技术方案，写入 docs/plans/ 并评审到通过。
```

```text
提交并推送当前改动，commit message 根据这次修改内容生成。
```

You can also explicitly name a skill if your agent supports that style:

```text
Use $req-maker to turn this spec into inputs/req.md.
```

## Repository Layout

```text
.
  install.mjs
  README.md
  README.zh-CN.md
  .codex-plugin/
    plugin.json
  skills/
    req-maker/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      install.py
      assets/
      scripts/
    req-reviewer/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      agents/
    plan-doc-maker/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      assets/
      agents/
    plan-executor/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      install.py
      agents/
    commit-push/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      scripts/
    piflow-status-inspector/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      agents/
      scripts/
    add-skill-lib/
      SKILL.md
      README.md
      README.zh-CN.md
      VERSION
      CHANGELOG.md
      install.mjs
      agents/
```

## Requirements

- Node.js for the repository installer.
- Python is optional. `skills/req-maker/install.py` is only a compatibility
  wrapper that calls the root Node.js installer.
- `commit-push` uses `git`; optional GitHub remote creation requires `gh` and
  an authenticated GitHub account.
- `piflow-status-inspector` uses Node.js to read and parse
  `output-stages/stages.json`.
- Codex plugin installation requires the `codex` command for the final
  `codex plugin add` step. Without it, the marketplace entry is still written.

## Development Notes

- Add a new skill by creating a directory under `skills/` that contains the
  required skill files: `SKILL.md`, `VERSION`, `CHANGELOG.md`, `README.md`,
  `README.zh-CN.md`, and `install.mjs`.
- The root installer discovers installable skills by scanning immediate child
  directories under `skills/` for `SKILL.md`.
- Keep installer behavior in `install.mjs`; skill-local install scripts should
  stay thin wrappers.
- Keep `README.md` as the English skill documentation and `README.zh-CN.md` as
  the Chinese skill documentation.
