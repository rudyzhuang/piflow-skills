---
name: add-skill-lib
description: Add a new skill library into the PiFlow pipeline repository. Use when the user asks to 纳入新的 skill library, add/register/sync a skill library, update PiFlow skill-libraries templates, expose skills in skills-template.yaml, wire a skill into enabled stages or workflows, validate path + locator contracts, add skill.yaml metadata, or update PiFlow skill library self-tests.
---

# Add Skill Library

## Scope

Use this skill only for adding or synchronizing a skill library inside the PiFlow pipeline repository named `piflow`.

Before editing, verify the current project is the PiFlow pipeline repository:

1. Check that the current directory is the `piflow` repository root or a path inside it.
2. Confirm expected repository files exist, including `templates/skill-libraries-template.yaml` and `templates/skills-template.yaml`.
3. If the current project is not `piflow`, stop and tell the user to switch to the correct PiFlow pipeline repository directory. Do not apply these changes in a business project or in a standalone skills plugin repository.

## Workflow

1. Add or synchronize the library source under the pipeline repository.
   - Create or update `skill-libraries/<library-name>/`.
   - If the library uses the unified skills root layout, place actual skills under `skill-libraries/<library-name>/skills/<skill-id>/`.
   - Every referenced skill directory must contain a real `SKILL.md`.
   - If `skill.yaml` is used, keep it in the same skill directory as `SKILL.md`.

2. Register the library source in `templates/skill-libraries-template.yaml`.
   - Add one entry under `libraries[]`.
   - Include at least:
     - `name`
     - `type`
     - `path`
     - `source`
     - `description`
     - `install.verify`
   - Set `path` to the real library root inside the `piflow` repository.
   - Do not point `path` at a business project directory.

3. Expose available skills in `templates/skills-template.yaml`.
   - Add each skill under `catalog.skills.<skill_id>`.
   - Declare:
     - `library`
     - `locator`
     - `install`
   - Wire the skill into `enabled.<stage>` or `workflows.<workflow>.<step>` only when the library should be injected for that stage or workflow.

4. Calibrate the `path + locator` contract.
   - The runtime target must satisfy: `library.path + locator -> <skill-dir>`.
   - `<skill-dir>/SKILL.md` must exist.
   - If `locator` is a skill id such as `req-maker`, `library.path` should usually end at `.../skills`, not at the parent repository root.
   - Prefer explicit checks using local path resolution before running broader tests.

5. Complete `skill.yaml` metadata when adding or updating a skill.
   Include all five groups:
   - Metadata: `name`, `version`, `source`, `license`, `tags`
   - Applicability: `stage`, `role`, `client_target`, `framework`, `cloud`, `domain`
   - Skill description: concise Chinese summary distilled from the skill instructions
   - Injection content: `prompt_fragments`, `checklist`, `examples`, `constraints`
   - Output constraints: `schema_patch` or `review_rules`
   - Risk level: one of `prompt-only`, `read-only`, `code-write`, `external-tool`

6. Add or update self-tests and schema regression coverage.
   Update at least:
   - `self-test-skills-yaml-schema.cjs`
   - `self-test-runtime-dependency-installer.cjs`
   - `self-test-runtime-stage-skill-resolver.cjs`

   Verify:
   - Templates pass schema validation.
   - Runtime can resolve the new library.
   - Stage or workflow configuration injects the expected skill into `runtime_skills`.

7. Preserve the single-copy constraint.
   - Keep actual library code only in `piflow/skill-libraries/`.
   - Business project `piflow_runtime/skill-libraries.yaml` files should store references only, not copied source code.
   - If runtime cannot find the referenced library, fail fast and block the run.
   - Do not add fallback behavior that auto-copies source into the business project.

## Validation

After implementation, run the focused self-tests that cover the touched contracts. If the repository provides a broader pipeline self-test command, run it when the change touches shared runtime resolution.

In the final response, report:

- library name and path
- skill ids exposed
- stages or workflows wired
- tests run and results
- any intentional omissions, such as a skill created but not yet enabled for a stage
