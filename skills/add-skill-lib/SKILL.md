---
name: add-skill-lib
description: Add or sync Git-hosted skill libraries into the PiFlow pipeline repository. Two modes: (1) single library mode — use when the user provides a Git URL and asks to 增加技能库, 增加piflow技能库, 增加pif技能库, add skill lib, add pif skill lib, add piflow skill lib, 纳入新的 skill library, clone/register/sync a skill library into skill-libraries/repos, extract library and skill metadata, write skill.yaml under skill-libraries/libs, register it in skill-libraries/libraries.yaml, expose skills in skills-template.yaml, wire skills into stages/workflows, validate path plus locator contracts, or update PiFlow skill library self-tests; (2) batch sync mode — use when the user asks to 安装技能库, 安装 piflow 技能库, 安装 pif 技能库, 检查技能库, 更新技能库, 更新 piflow 技能库, 更新 pif 技能库, or any request to batch-install/verify/update all registered skill libraries without providing a specific Git URL. In batch mode read skill-libraries/libraries.yaml, for each library entry check if the source repo is cloned under skill-libraries/repos/, clone any missing repos, update existing repos on update requests, verify metadata paths exist, and report the complete status of every registered library.
---

# Add Skill Library

## Scope

Use this skill only for adding or synchronizing Git-hosted skill libraries inside the PiFlow pipeline repository named `piflow`. This skill supports two modes:

1. **Single library mode**: add or update a single skill library when a Git URL is provided.
2. **Batch sync mode**: batch-install, verify, or update all registered skill libraries from `skill-libraries/libraries.yaml`.

Before editing, verify the current project is the PiFlow pipeline repository:

1. Check that the current directory is the `piflow` repository root or a path inside it.
2. Confirm expected repository files exist, including `skill-libraries/libraries.yaml` and `templates/skills-template.yaml`.
3. If the current project is not `piflow`, stop and tell the user to switch to the correct PiFlow pipeline repository directory. Do not apply these changes in a business project or in a standalone skills plugin repository.

### Mode selection

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

1. Derive and confirm the library identity.
   - Derive a default `<library-name>` from the Git URL repository slug:
     - strip `.git`
     - lowercase
     - replace spaces, underscores, and invalid path characters with `-`
     - collapse repeated `-`
   - Prefer an explicit user-provided library name over the derived name.
   - Use `skill-libraries/repos/<library-name>/` as the only source checkout location inside `piflow`.
   - Use `skill-libraries/libs/<library-name>/` as the generated PiFlow skill metadata location.

2. Clone or synchronize the library source under the pipeline repository.
   - If `skill-libraries/repos/<library-name>/` does not exist, run:

     ```bash
     git clone <git-url> skill-libraries/repos/<library-name>
     ```

   - If the directory already exists and is a Git checkout of the same remote, update it with `git fetch` and a normal fast-forward-safe pull or merge according to the repository's existing policy.
   - If the directory exists but is not a Git checkout of the same remote, stop and ask the user whether to rename, replace, or reuse the existing directory.
   - Do not clone into a business project.
   - Do not copy the library source into `piflow_runtime/`.

3. Discover the skill layout inside the cloned repository.
   - Prefer the unified skills root layout when `<library-root>/skills/<skill-id>/SKILL.md` exists.
   - Otherwise, treat any directory containing `SKILL.md` as a candidate skill directory.
   - Every referenced skill directory must contain a real `SKILL.md`.
   - If a source `skill.yaml` exists beside `SKILL.md`, read it as input.
   - Write or update the normalized PiFlow metadata at `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`.
   - If no `SKILL.md` is found, stop and report that the Git repository is not a valid skill library yet.

4. Extract the fields needed for PiFlow library and skill configuration.
   - Library `name`: use the confirmed `<library-name>`.
   - Library `type`: for a cloned Git repository, use `git` unless existing `skill-libraries/libraries.yaml` conventions require a more specific value.
   - Library `path`: set to the real source skill root inside `piflow`, usually `piflow/skill-libraries/repos/<library-name>/skills` for unified skills layout.
   - Library `install.method`: use `manual`, because PiFlow keeps one checked-out source copy under `skill-libraries/repos/`.
   - Library `install.docs`: state that the pipeline repository maintains the single source copy and does not copy skill code into business projects.
   - Library `install.verify`: derive from real files. Prefer `kind: path_exists` checks that prove the expected source skill root exists, such as `piflow/skill-libraries/repos/<library-name>/skills`.
   - Library `source.repo`: use the provided Git URL.
   - Library `source.ref`: use the user-specified branch/ref when provided; otherwise infer the cloned repository's current branch or default to `main` when that is the checked-out branch.
   - Skill id: prefer `skill.yaml.name`, then `SKILL.md` frontmatter `name`, then the skill directory name.
   - Skill `locator`: compute the relative path from `library.path` to the skill directory. If `library.path` ends at `.../skills`, a unified layout skill usually has `locator: <skill-id>`.
   - Skill `install`: mirror the existing template shape and include enough data for runtime installation or prompt injection.
   - Skill metadata path: always write the normalized `skill.yaml` to `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`; do not write generated PiFlow metadata back into the cloned source repository unless the user explicitly asks.

5. Register the library source in `skill-libraries/libraries.yaml`.
   - Add one entry under `libraries[]`.
   - Include at least:
     - `name`
     - `type`
     - `path`
     - `install.method`
     - `install.docs`
     - `install.verify`
     - `source.repo`
     - `source.ref` when known
   - Set `path` to the real source skill root inside the `piflow` repository, not the `libs` metadata directory.
   - Do not point `path` at a business project directory.
   - Do not modify `templates/skill-libraries-template.yaml`; that template is no longer the source of truth for library registration.

6. Expose available skills in `templates/skills-template.yaml`.
   - Add each skill under `catalog.skills.<skill_id>`.
   - Declare:
     - `library`
     - `locator`
     - `install`
   - Wire the skill into `enabled.<stage>` or `workflows.<workflow>.<step>` only when the library should be injected for that stage or workflow.

7. Calibrate the `path + locator` contract.
   - The runtime target must satisfy: `library.path + locator -> <skill-dir>`.
   - `<skill-dir>/SKILL.md` must exist.
   - If `locator` is a skill id such as `req-maker`, `library.path` should usually end at `.../skills`, not at the parent repository root.
   - Prefer explicit checks using local path resolution before running broader tests.

8. Complete or normalize PiFlow `skill.yaml` metadata when adding or updating a skill.
   - First extract existing values from source `skill.yaml`, `SKILL.md`, README files, package manifests, license files, and repository topics/tags when available locally.
   - Preserve accurate source facts; do not invent unsupported compatibility claims.
   - If a field cannot be inferred safely, use a conservative default or mark it as requiring user confirmation according to the target schema.
   - Write the result to `skill-libraries/libs/<library-name>/<skill-id>/skill.yaml`.

   Include all five groups:
   - Metadata: `name`, `version`, `source`, `license`, `tags`
   - Applicability: `stage`, `role`, `client_target`, `framework`, `cloud`, `domain`
   - Skill description: concise Chinese summary distilled from the skill instructions
   - Injection content: `prompt_fragments`, `checklist`, `examples`, `constraints`
   - Output constraints: `schema_patch` or `review_rules`
   - Risk level: one of `prompt-only`, `read-only`, `code-write`, `external-tool`

9. Add or update self-tests and schema regression coverage.
   Update at least:
   - `self-test-skills-yaml-schema.cjs`
   - `self-test-runtime-dependency-installer.cjs`
   - `self-test-runtime-stage-skill-resolver.cjs`

   Verify:
   - Templates pass schema validation.
   - Runtime can resolve the new library.
   - Stage or workflow configuration injects the expected skill into `runtime_skills`.

10. Preserve the single-copy constraint.
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
- stages or workflows wired
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
