# myskills

Personal Agent Skills for Cursor, Codex, and Claude Code.

This repository keeps multiple skills in one place and uses a single root
installer, `install.mjs`, to install or sync them into local agent skill
directories.

## Current Skills

| Skill | Purpose | Main files |
| --- | --- | --- |
| `req-maker` | Extract product requirements from prompts, docs, specs, screenshots, or Figma Make `.make` bundles, then generate a Chinese PiFlow-style `inputs/req.md` with review loops. | `req-maker/SKILL.md`, `req-maker/assets/req-template.md`, `req-maker/scripts/figma-make-summary.mjs` |
| `commit-push` | Turn "commit and push" into a repeatable Git workflow: inspect changes, derive commit intent, optionally bump versions, commit, push, and optionally create missing GitHub remotes. | `commit-push/SKILL.md`, `commit-push/scripts/commit_push.cjs`, `commit-push/scripts/github_remote.cjs` |

## Supported Agents

The installer detects and installs to these user-level skill directories:

| Agent | Install path |
| --- | --- |
| Cursor | `~/.cursor/skills/<skill-name>` |
| Codex | `~/.codex/skills/<skill-name>` |
| Claude Code | `~/.claude/skills/<skill-name>` |

By default, the installer creates symlinks from the agent skill directory back
to this repository. That keeps one editable source copy. Re-run the installer
after moving this repository.

Before installing, an existing installed copy of the same skill is removed and
replaced with the current version.

## Install

Install all skills detected in this repository:

```bash
node install.mjs
```

Install one skill:

```bash
node install.mjs req-maker
node install.mjs commit-push
```

Install multiple selected skills:

```bash
node install.mjs req-maker commit-push
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
node install.mjs commit-push --only claude
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
cd req-maker
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
  req-maker/
    SKILL.md
    README.md
    VERSION
    assets/
    scripts/
  commit-push/
    SKILL.md
    README.md
    VERSION
    scripts/
```

## Requirements

- Node.js for the repository installer.
- Python is optional. `req-maker/install.py` is only a compatibility wrapper
  that calls the root Node.js installer.
- `commit-push` uses `git`; optional GitHub remote creation requires `gh` and
  an authenticated GitHub account.

## Development Notes

- Add a new skill by creating a directory that contains `SKILL.md`.
- The root installer discovers installable skills by scanning immediate child
  directories for `SKILL.md`.
- Keep installer behavior in `install.mjs`; skill-local install scripts should
  stay thin wrappers.
