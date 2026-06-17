# Changelog

## 0.1.7 - 2026-06-17

- 更新 piflow skills 文档与提交推送流程
- Changed: 22 file(s).
- Areas: skills(21), .(1).
- Hints: scripts/tests, documentation.
- Added: 13, Modified: 9, Deleted: 0.

## 0.1.6 - 2026-06-16

- 对齐 add-skill-lib 的技能库目录结构
- Changed: 8 file(s).
- Areas: skills(6), .(2).
- Hints: documentation.

## 0.1.5 - 2026-06-16

- Align the workflow with the new PiFlow skill library directory layout.
- Clone source repositories under `skill-libraries/repos/<library-name>`.
- Write generated PiFlow `skill.yaml` metadata under `skill-libraries/libs/<library-name>/<skill-name>/`.

## 0.1.4 - 2026-06-16

- Change library registration target from `templates/skill-libraries-template.yaml` to `skill-libraries/libraries.yaml`.
- Align extracted library fields with the current `libraries.yaml` shape.

## 0.1.3 - 2026-06-16

- 增强 add-skill-lib 的 Git 地址接入与触发词
- Changed: 8 file(s).
- Areas: skills(6), .(2).
- Hints: documentation.

## 0.1.2 - 2026-06-16

- Update workflow to start from a user-provided Git URL.
- Require cloning or synchronizing the library into `skill-libraries/<library-name>`.
- Add repository metadata extraction rules for library templates, skill catalog entries, and `skill.yaml`.

## 0.1.1 - 2026-06-16

- 新增 add-skill-lib 并完善安装入口
- Changed: 9 file(s).
- Areas: skills(7), .(2).
- Hints: documentation.
- Added: 7, Modified: 2, Deleted: 0.

## 0.1.0 - 2026-06-16

- Add initial `add-skill-lib` skill.
- Document the PiFlow skill library registration workflow, `path + locator` contract, `skill.yaml` requirements, self-test coverage, and single-copy constraint.
