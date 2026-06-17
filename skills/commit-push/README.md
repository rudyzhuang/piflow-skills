# commit-push

Chinese documentation: [README.zh-CN.md](./README.zh-CN.md).

`commit-push` is an Agent Skill that turns "commit and push" into a repeatable Git workflow for any repository. It inspects changes, derives commit intent from the conversation, maintains project and subproject version logs, commits, pushes, and can optionally create missing GitHub remotes.

## What It Does

- Collects Git facts from the target repository.
- Supports multi-repository changes through repeated `--file` arguments.
- Generates or uses a commit message from `--intent` or `-m`.
- Blocks obvious secret files before staging.
- Maintains `VERSION` and `CHANGELOG.md` for changed subprojects first, then for the repository root.
- Creates missing `VERSION` and `CHANGELOG.md` files automatically, initializing new versions at `0.1.0`.
- Fetches before push and pulls with merge when the remote is ahead.
- Uses a default push proxy unless disabled or overridden.
- Prints a structured operation report for the agent to summarize.

## Install

From the repository root:

```bash
node install.mjs commit-push
```

From this skill directory, the local wrapper forwards to the root installer:

```bash
node install.mjs
```

Useful installer options:

```bash
node ../install.mjs commit-push --dry-run
node ../install.mjs commit-push --only codex
node ../install.mjs commit-push --only cursor
node ../install.mjs commit-push --only claude
node ../install.mjs commit-push --copy
```

## Usage

Typical agent invocation:

```text
提交并推送当前改动，commit message 根据这次修改内容生成。
```

Direct script preview:

```bash
node scripts/commit_push.cjs --intent="Update skill documentation" --dry-run
```

Direct script execution:

```bash
node scripts/commit_push.cjs --intent="Update skill documentation" --yes
```

Multi-repository execution:

```bash
node scripts/commit_push.cjs \
  --intent="Synchronize plan index naming" \
  --file=/path/to/repo-a/file.md \
  --file=/path/to/repo-b/file.md \
  --yes
```

## Files

- `SKILL.md`: agent-facing workflow and safety rules.
- `VERSION`: current skill version.
- `CHANGELOG.md`: version history.
- `README.md` / `README.zh-CN.md`: English and Chinese documentation.
- `install.mjs`: compatibility wrapper for the root installer.
- `scripts/commit_push.cjs`: main commit/push implementation.
- `scripts/github_remote.cjs`: optional GitHub remote detection and creation helper.
