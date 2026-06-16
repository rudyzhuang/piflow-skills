---
name: add-skill-lib
description: Add a Git-hosted skill library into the PiFlow pipeline repository. Use when the user provides a Git URL and asks to 增加技能库, 增加piflow技能库, 增加pif技能库, add skill lib, add pif skill lib, add piflow skill lib, 纳入新的 skill library, clone/register/sync a skill library into skill-libraries/repos, extract library and skill metadata, write skill.yaml under skill-libraries/libs, register it in skill-libraries/libraries.yaml, expose skills in skills-template.yaml, wire skills into stages/workflows, validate path plus locator contracts, or update PiFlow skill library self-tests.
---

# Add Skill Library

## Scope

Use this skill only for adding or synchronizing a Git-hosted skill library inside the PiFlow pipeline repository named `piflow`.

Before editing, verify the current project is the PiFlow pipeline repository:

1. Check that the current directory is the `piflow` repository root or a path inside it.
2. Confirm expected repository files exist, including `skill-libraries/libraries.yaml` and `templates/skills-template.yaml`.
3. If the current project is not `piflow`, stop and tell the user to switch to the correct PiFlow pipeline repository directory. Do not apply these changes in a business project or in a standalone skills plugin repository.
4. Require a Git repository URL from the user. If the user did not provide one, ask for it before changing files.

## Workflow

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

In the final response, report:

- library name and path
- Git URL and resolved checkout action, such as cloned, pulled, or reused
- skill ids exposed
- generated `skill.yaml` paths under `skill-libraries/libs/<library-name>/`
- key fields extracted from the cloned repository and any fields needing confirmation
- stages or workflows wired
- tests run and results
- any intentional omissions, such as a skill created but not yet enabled for a stage
