---
name: add-skill-lib
description: >-
  Use when adding, registering, installing, checking, or updating Git-hosted
  PiFlow skill libraries, especially requests mentioning 增加技能库, 安装技能库,
  检查技能库, 更新技能库, add skill lib, add piflow skill lib, or skill-libraries.
---

# Add Skill Library

## Scope

Use this skill only for adding or synchronizing Git-hosted skill libraries inside the PiFlow pipeline repository named `piflow`. This skill supports two modes:

1. **Single library mode**: add or update a single skill library when a Git URL is provided.
2. **Batch sync mode**: batch-install, verify, or update all registered skill libraries from `skill-libraries/libraries.yaml`.

Before editing, resolve and verify the PiFlow pipeline repository root:

1. Prefer the `pif-skill-lib` or `piflow-skill-lib` wrapper; it injects `PIFLOW_DIR` automatically.
2. If running `scripts/skill-lib.cjs` directly, first ensure `PIFLOW_DIR` points to the PiFlow repository root.
3. Confirm `PIFLOW_DIR` contains `skill-libraries/libraries.yaml` and `templates/skills-template.yaml`.
4. Do not pass `--project`; the skill library CLI no longer supports that flag.
5. If no valid PiFlow root can be resolved through `PIFLOW_DIR`, stop and ask the user to fix `PIFLOW_DIR` or reinstall/link PiFlow. Do not apply these changes in a business project or in a standalone skills plugin repository.
6. For single library mode, require a Git repository URL from the user. If the user did not provide one, ask for it before changing files.

## Mode selection

- If the user provides a specific Git URL OR asks to add/register/include a new library: use **Single library mode** (Workflow section below).
- If the user asks to install/check/update skill libraries in general without providing a Git URL, using trigger words like 安装技能库, 安装 piflow 技能库, 安装 pif 技能库, 检查技能库, 更新技能库, 更新 piflow 技能库, 更新 pif 技能库: use **Batch sync mode** (Batch Sync Mode section below).

## Batch Sync Mode

This mode handles bulk installation, verification, and update of all skill libraries registered in `skill-libraries/libraries.yaml`.

### Trigger words

安装技能库, 安装 piflow 技能库, 安装 pif 技能库, 检查技能库, 更新技能库, 更新 piflow 技能库, 更新 pif 技能库

### Operation type detection

| Trigger word contains | Operation |
|----------------------|-----------|
| 安装 | **Install**: clone missing repos, skip existing ones (unless stale/broken), generate missing metadata |
| 检查 | **Check**: verify all repos and metadata exist, report status only, do NOT clone or pull |
| 更新 | **Update**: clone missing repos, `git pull` existing ones to latest, regenerate metadata for changed skills |

### Workflow

1. **Read the library registry.**
   - Parse `skill-libraries/libraries.yaml` to extract every library entry.
   - For each entry, capture: `name`, `type`, `path`, `metadata_path`, `install.verify`, `source.repo`, `source.ref`.

2. **Check repo status for each library.**
   For every library entry in order:
   - Extract the repo directory name from `path`. For example, if `path: piflow/skill-libraries/repos/piflow-skills/skills`, the repo directory is `skill-libraries/repos/piflow-skills`.
   - Check if the repo directory exists and contains a `.git` folder.
   - If it exists, verify the remote URL matches `source.repo`:
     ```bash
     git -C skill-libraries/repos/<repo-dir> remote get-url origin
     ```
   - Report the current status: repo exists / missing / remote mismatch.

3. **Execute the operation for each library.**

   **For 安装 (install) mode:**
   - If repo directory does NOT exist:
     ```bash
     git clone --depth 1 --branch <source.ref> <source.repo> skill-libraries/repos/<repo-dir>
     ```
   - If repo directory exists but remote does NOT match `source.repo`: warn and skip, ask user how to handle.
   - If repo directory exists with correct remote: skip (already installed), report "already present".
   - Check if `metadata_path` directory exists; if not, generate metadata by scanning the skills directory.

   **For 检查 (check) mode:**
   - Report for each library:
     - Repo status: exists / missing
     - If repo exists: current HEAD commit hash and branch
     - Metadata status: `metadata_path` directory exists / missing
     - Verify paths: check all `install.verify` paths exist
   - Do NOT clone, pull, or write any files.
   - Present a summary table of all libraries and their status.

   **For 更新 (update) mode:**
   - If repo directory does NOT exist:
     ```bash
     git clone --depth 1 --branch <source.ref> <source.repo> skill-libraries/repos/<repo-dir>
     ```
   - If repo directory exists with correct remote:
     ```bash
     git -C skill-libraries/repos/<repo-dir> fetch origin <source.ref>
     git -C skill-libraries/repos/<repo-dir> checkout <source.ref>
     git -C skill-libraries/repos/<repo-dir> pull origin <source.ref>
     ```
   - If repo directory exists but remote does NOT match: warn and skip, ask user how to handle.
   - After updating repo, regenerate skill metadata if source skills have changed.

4. **Verify metadata paths.**
   - For each library, check that `metadata_path` directory exists.
   - If missing (and not in check mode), create the directory and regenerate `skill.yaml` for each skill found in the repo.

5. **Run `install.verify` checks.**
   - For each library, execute every verify check defined in `install.verify`.
   - Report pass/fail for each check.

6. **Present final report.**
   For batch sync mode, output a summary report covering:
   - Total libraries processed
   - Libraries cloned (newly installed)
   - Libraries updated (pulled)
   - Libraries skipped (already present)
   - Libraries with errors (repo mismatch, clone failure, verify failure)
   - For each library: name, repo URL, ref, local path, status, verify results

### Batch sync validation

After batch operations complete:
- Verify all `install.verify` checks pass for every library.
- If in update mode, confirm that updated repos still have valid skill layouts (SKILL.md files exist in expected locations).
- Report any libraries that could not be processed and why.

## Workflow (Single Library Mode)

Prefer the PiFlow skill library CLI for normal add/list/remove work. The entrypoint is:

```bash
pif-skill-lib add <git-url-or-path> [--library=name] [--ref=main] [--write] [--json]
```

Equivalent forms are `piflow-skill-lib ...` and `pif skill-lib ...`.

The CLI defaults to dry-run mode. Use dry-run first, then run again with `--write` only after the preview is reasonable.

1. Derive and preview the library identity.
   - Derive a default `<library-name>` from the Git URL repository slug:
     - strip `.git`
     - lowercase
     - replace spaces, underscores, and invalid path characters with `-`
     - collapse repeated `-`
   - Prefer an explicit user-provided library name over the derived name.
   - Use `skill-libraries/repos/<library-name>/` as the only source checkout location inside `piflow`.
   - Use `skill-libraries/libs/<library-name>/` as the generated PiFlow skill metadata location.
   - Preview the operation:

     ```bash
     pif-skill-lib add <git-url-or-path> --library=<library-name> --ref=<ref> --json
     ```

2. Add the library through the CLI.
   - If the preview is correct, run:

     ```bash
     pif-skill-lib add <git-url-or-path> --library=<library-name> --ref=<ref> --write --json
     ```

   - The CLI clones the source into `skill-libraries/repos/<library-name>/` when missing.
   - If the source checkout already exists, the CLI reuses it. If the user expects a refresh, inspect the checkout and update it with the repository's normal Git policy before rerunning the CLI.
   - If the directory exists but is not the intended checkout, stop and ask the user whether to rename, replace, or reuse the existing directory.
   - Do not clone into a business project.
   - Do not copy the library source into `piflow_runtime/`.

3. Inspect the CLI report.
   - Prefer `--json` output so the final report can cite exact actions.
   - Confirm `mode` is `write`.
   - Confirm `actions` includes clone or reuse, metadata writes, catalog upserts, library upsert, and template update.
   - Confirm `skills` contains the expected skill ids.
   - Treat every id in `skills` as requiring metadata enrichment, even when the skill remains catalog-only/disabled.

4. Discover or troubleshoot the skill layout when the CLI reports no skills.
   - Prefer the unified skills root layout when `<library-root>/skills/<skill-id>/SKILL.md` exists.
   - Otherwise, treat any directory containing `SKILL.md` as a candidate skill directory.
   - Every referenced skill directory must contain a real `SKILL.md`.
   - If a source `skill.yaml` exists beside `SKILL.md`, read it as input.
   - Write or update the normalized PiFlow metadata at `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`.
   - If no `SKILL.md` is found, stop and report that the Git repository is not a valid skill library yet.

5. Understand the fields generated by the CLI.
   - Library `name`: use the confirmed `<library-name>`.
   - Library `type`: for a cloned Git repository, use `git` unless existing `skill-libraries/libraries.yaml` conventions require a more specific value.
   - Library `path`: set to the real source skill root inside `piflow`, usually `piflow/skill-libraries/repos/<library-name>/skills` for unified skills layout.
   - Library `metadata_path`: set to `piflow/skill-libraries/libs/<library-name>`.
   - Library `install.method`: use `git`.
   - Library `install.verify`: include `kind: path_exists` checks for the source skill root and generated metadata root.
   - Library `source.repo`: use the provided Git URL.
   - Library `source.ref`: use the user-specified branch/ref when provided; otherwise the CLI defaults to `main`.
   - Skill id: prefer `skill.yaml.name`, then `SKILL.md` frontmatter `name`, then the skill directory name.
   - Skill `locator`: compute the relative path from `library.path` to the skill directory. If `library.path` ends at `.../skills`, a unified layout skill usually has `locator: <skill-id>`.
   - Skill `install`: use the generated built-in source path plus a `skill_manifest` verification for `SKILL.md`.
   - Skill metadata path: always write the normalized `skill.yaml` to `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`; do not write generated PiFlow metadata back into the cloned source repository unless the user explicitly asks.

6. Verify the registry and catalog.
   - Run:

     ```bash
     pif-skill-lib list --json
     ```

   - Confirm the new library has `source_exists: true` and `metadata_exists: true`.
   - Confirm `status.orphan_metadata`, `status.missing_metadata`, and `status.missing_source` are empty.
   - New skills are cataloged but intentionally unused by default. `status.unused_skills` may include the new skill ids until a user explicitly enables them in a profile, stage, or workflow.
   - Do not modify `templates/skill-libraries-template.yaml`; that template is no longer the source of truth for library registration.

7. Calibrate the `path + locator` contract if the list report shows missing source or metadata.
   - The runtime target must satisfy: `library.path + locator -> <skill-dir>`.
   - `<skill-dir>/SKILL.md` must exist.
   - If `locator` is a skill id such as `req-maker`, `library.path` should usually end at `.../skills`, not at the parent repository root.
   - Prefer explicit checks using local path resolution before running broader tests.

8. Let the CLI own `skill.yaml` inference, then audit the result.
   - Treat `pif-skill-lib add ... --write` as the single source of truth for generated PiFlow metadata.
   - Do not reimplement field-by-field inference logic inside this skill. The generator is responsible for deriving `summary`, `tags`, `applicability`, `injection`, `risk_level`, `composition`, `selection`, and optional `usage` notes.
   - After write-mode generation, inspect every generated `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml` and verify that the result is plausible against local source facts such as `SKILL.md`, source `skill.yaml`, `README`, `VERSION`, package manifests, examples, and nearby scripts.
   - If the generated metadata is obviously wrong or too aggressive, correct it conservatively in the generated file instead of inventing a parallel inference workflow.
   - Prefer safe defaults when adjusting generated output:
     - keep unsupported dimensions as `[]`, `null`, or `unknown`
     - do not invent unsupported PiFlow stage, role, framework, cloud, or domain claims
     - keep third-party skills `selection.role=disabled` unless the user explicitly asked to enable them
     - choose the safer `risk_level` when a skill could plausibly fit more than one class
   - Write enriched metadata only to `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`; do not write generated PiFlow metadata back into the cloned source repository unless the user explicitly asks.

9. Derive runtime wiring guidance only as recommendations unless the user asked to enable skills.
   - Use the generated metadata to explain likely wiring points, but do not add skills to `enabled` or `workflows` solely because the metadata suggests a fit.
   - Prefer `catalog_only` or equivalent disabled-by-default guidance for newly added third-party libraries unless the user explicitly asked to wire them into PiFlow runtime.
   - When the user did ask for enablement, verify that the suggested stage, unit, workflow, `risk_level`, `selection`, and `composition` are consistent with current PiFlow runtime contracts before editing any profile or template.
   - If a skill appears to require new runtime policy, new stage wiring, or non-obvious role mapping, surface that explicitly in the final report instead of silently enabling it.

10. Add or update self-tests and schema regression coverage only when changing shared contracts.
   Always run the focused CLI regression:

   ```bash
   node scripts/self-test/self-test-skill-lib-cli.cjs
   ```

   If you manually changed registry, template, resolver, dependency, or schema behavior, also update and run the relevant tests:
   - `self-test-skills-yaml-schema.cjs`
   - `self-test-runtime-dependency-installer.cjs`
   - `self-test-runtime-stage-skill-resolver.cjs`

   Verify:
   - Templates pass schema validation.
   - Runtime can resolve the new library.
   - Stage or workflow configuration injects the expected skill into `runtime_skills` when the user explicitly requested enabling the skill.

11. Preserve the single-copy constraint.
   - Keep actual library source code only in `piflow/skill-libraries/repos/`.
   - Keep generated PiFlow metadata only in `piflow/skill-libraries/libs/`.
   - Business project `piflow_runtime/skill-libraries.yaml` files should store references only, not copied source code.
   - If runtime cannot find the referenced library, fail fast and block the run.
   - Do not add fallback behavior that auto-copies source into the business project.

## Validation

After implementation, run the focused self-tests that cover the touched contracts. If the repository provides a broader pipeline self-test command, run it when the change touches shared runtime resolution.

### Single library mode report

In the final response for single library mode, report:

- library name and path
- Git URL and resolved checkout action, such as cloned, pulled, or reused
- skill ids exposed
- generated `skill.yaml` paths under `skill-libraries/libs/<library-name>/`
- key fields extracted from the cloned repository and any fields needing confirmation
- stages or workflows wired, or state that the skills remain catalog-only/disabled
- tests run and results
- any intentional omissions, such as a skill created but not yet enabled for a stage

### Batch sync mode report

In the final response for batch sync mode, report:

- operation type performed (安装 / 检查 / 更新)
- total libraries processed, with counts for each outcome category
- per-library status table:

| Library | Repo URL | Ref | Local Path | Status | Detail |
|---------|----------|-----|------------|--------|--------|
| name | url | ref | path | installed/updated/skipped/error | commit hash or error message |

- verify results: which `install.verify` checks passed or failed per library
- any libraries that could not be processed and the reason
- recommendations for any libraries needing manual attention
