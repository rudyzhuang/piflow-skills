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

8. Auto-enrich every generated PiFlow `skill.yaml`.
   - This step is mandatory for every skill id returned by the write-mode CLI report.
   - The CLI generates conservative metadata first. After that, read and update every generated file at `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`.
   - Do not stop to ask the user for field-by-field confirmation. Infer from local source files and use conservative defaults for uncertain fields.
   - Read, when present: source `skill.yaml`, `SKILL.md` frontmatter and body, README files, `VERSION`, package manifests, license files, and nearby examples/scripts.
   - Preserve accurate source facts; do not invent unsupported compatibility claims.
   - If a field cannot be inferred safely, prefer `unknown`, `null`, or `[]` according to the schema, and record uncertainty in `selection.reason` or a concise metadata note when useful.
   - Write the enriched result only to `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`; do not write generated PiFlow metadata back into the cloned source repository unless the user explicitly asks.

   Fill or refine these groups for every skill:
   - Metadata: `name`, `version`, `source`, `license`, `tags`, `summary`
   - Applicability: `stage`, `role`, `client_target`, `framework`, `cloud`, `domain`
   - Injection content: `prompt_fragments`, `checklist`, `examples`, `constraints`, plus `core_rules` when the skill has explicit non-negotiable rules
   - Output controls: `schema_patch` and `review_rules`
   - Risk: `risk_level`, using the safest accurate level from `prompt-only`, `read-only`, `code-write`, `external-tool`
   - Composition: `priority`, `provides`, `requires`, `conflicts_with`
   - Selection: `role`, `capability`, `fallback_for`, `companion_with`, `reason`

   Inference rules:
   - `summary`: write a concise Chinese summary from the skill frontmatter description and main instructions.
   - `tags`: include the library name plus capability/domain keywords found in the skill name, description, headings, README, or package manifest.
   - `license`: use source `skill.yaml`, package manifest, or license file; otherwise use `unknown` or `null` consistently with existing repository conventions.
   - `applicability.stage`: infer only when the skill clearly targets PiFlow stages such as setup, prd, design, codegen, review, test, merge, report, or recovery.
   - `applicability.role`: infer agent roles such as planner, reviewer, implementer, tester, debugger, documenter, or publisher when stated or strongly implied.
   - `client_target`, `framework`, `cloud`, `domain`: infer from explicit keywords and referenced tools; leave empty arrays when not specific.
   - `injection.checklist`: distill concrete required actions from imperative instructions and validation sections.
   - `injection.examples`: include local example/template paths only when they exist and are relevant.
   - `injection.constraints`: include prohibitions, safety rules, required ordering, and path or output constraints.
   - `output_controls.review_rules`: extract review gates, acceptance checks, schema requirements, and final response requirements.
   - `risk_level`: use `prompt-only` for instruction-only skills, `read-only` when filesystem or external inspection is expected, `code-write` when the skill edits files, and `external-tool` when it requires network, deployment, credentials, or external services.
   - `composition.provides`: name the concrete capability the skill contributes, such as `requirements`, `code-review`, `debugging`, `git-workflow`, or `skill-authoring`.
   - `composition.requires`: list prerequisite skills or capabilities only when explicitly required.
   - `composition.conflicts_with`: list conflicts only when the source states them.
   - `selection`: keep new third-party skills `disabled` by default unless the user explicitly asks to enable them; still infer `capability` and a short `reason`.

9. Derive runtime wiring guidance for every new skill.
   - Understand the PiFlow runtime trigger chain before recommending wiring:
     1. `piflow_runtime/skills.yaml.catalog.skills.<skill_id>` registers the skill source and install contract.
     2. `enabled.<stage>` or `enabled.<stage>.default` selects skills for a stage.
     3. `enabled.<stage>.units.<unit_id>` selects skills only for a stage execution unit; `mode: append` adds to stage defaults and `mode: replace` replaces them.
     4. `workflows.<workflow>.<step>` selects skills for workflow calls such as recovery analysis, plan_document, execution, or publish.
     5. `unit_rules` in `agents.yaml` or `skills.yaml` can map runtime context to a unit by matching `role`, `client_target`, `framework`, `language`, `cloud`, `domain`, or `artifact_paths`.
     6. `skill.yaml.applicability` is a filter after selection. Empty arrays mean "applies to all" for that dimension. Non-empty arrays must match the current stage/workflow, role, client target, framework, cloud, or domain, otherwise required skills block the run and optional skills are skipped.
     7. `risk_level` is checked against `skills.yaml.policy`; built-in defaults allow `prompt-only` and `read-only`, deny `code-write`, and require approval for `external-tool` unless stage/workflow policy overrides it.
     8. `selection` and `composition` run after policy: disabled/audit_only skills are skipped, duplicate primary capabilities block, fallback is skipped when a primary capability exists, companion skills require a matching selected id or capability, missing `requires` and `conflicts_with` block.
   - For each enriched `skill.yaml`, add enough metadata for future wiring decisions:
     - Use `applicability.stage` for the exact stages where the skill is safe and useful.
     - Use `applicability.role` for concrete agent roles from stage contracts when the skill should only affect a role, such as `codegen_executor`, `code_review_security`, `design_scope`, `test_triage`, or `report_author`.
     - Use `applicability.client_target`, `framework`, `cloud`, and `domain` to prevent unrelated units from receiving narrow skills.
     - Use `selection.capability` and `composition.provides` to name what the skill contributes in profile recommendations.
     - Use `selection.reason` to explain why the default role is `disabled`, `primary`, `fallback`, `companion`, or `audit_only`.
   - Add a generated usage note to the metadata when useful, using `usage` or another schema-tolerated field. Include:
     - `recommended_wiring`: one of `catalog_only`, `enabled_stage_default`, `enabled_stage_unit`, or `workflow_step`.
     - `stage_examples`: concrete YAML snippets for `enabled.<stage>`, `enabled.<stage>.units.<unit_id>`, or `workflows.<workflow>.<step>` when the fit is clear.
     - `policy_notes`: whether `risk_level` needs a `skills.yaml.policy` override before it can run.
     - `runtime_notes`: important applicability, unit, role, ordering, conflict, or approval cautions.
   - Prefer `catalog_only` for newly added third-party libraries unless the user explicitly asks to enable them. Still provide precise wiring examples so the user can opt in deliberately.
   - Do not add a skill to `enabled` or `workflows` solely because metadata suggests a fit. Only wire it when the user requested enablement or the library is part of an agreed profile change.
   - Use current stage names from PiFlow: `setup`, `prd`, `prd-review`, `design`, `design-review`, `codegen`, `ui-scenarios`, `code-review`, `merge`, `build`, `local-test`, `deploy`, `test`, `report`, and workflow `recovery`.
   - Use known agent roles from stage contracts when inferring `applicability.role`:
     - setup: `req_md_review`, `req_md_normalize`, `req_sync`, `req_test_cases`
     - prd: `prd_spec_author`, `prd_author`, `prd_author_website`, `prd_author_backend`, `prd_author_mobile`, `prd_author_admin`
     - prd-review: `prd_review`, `prd_review_website`, `prd_review_backend`, `prd_review_mobile`, `prd_review_admin`
     - design: `design`, `design_scope`, `design_file_plan`, `design_contracts`, `design_ux_test`
     - design-review: `design_review`, `design_review_alignment`, `design_review_readiness`, `design_review_dependency`
     - codegen: `codegen`, `codegen_resume`, `codegen_task_plan`, `codegen_executor`, `codegen_test_explainer`
     - code-review: `code_review`, `code_review_security`, `code_review_spec`, `code_review_test`
     - merge: `merge_triage`, `merge_push_triage`, `merge_openapi_review`
     - local-test: `local_test_triage`
     - deploy: `deploy_triage`
     - test: `test_triage`, `test_run_scenario`
     - report: `report_author`

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
