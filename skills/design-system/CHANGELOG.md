# Changelog

## 0.2.1 - 2026-06-20

- 新增 design-system skill 并更新中英文技能索引
- Changed: 10 file(s).
- Areas: skills(8), .(2).
- Hints: documentation.
- Added: 8, Modified: 2, Deleted: 0.

## 0.2.0 - 2026-06-20

- 把 OpenDesign 明确设为 `design-system` skill 的内置主参考设计系统库，并保留扩展到其他来源的策略。
- 新增 `scripts/opendesign-design-system.mjs`，支持从 OpenDesign 抓取目录、解析 pack、提取结构化内容，并输出 PiFlow 设计系统草稿。
- 更新 `SKILL.md`、双语 README 和 agent metadata，补充 helper 用法与参考源策略。
- helper 输出补充 `piflow_artifact`，对齐 PiFlow `design.json` 的 `implementation_spec.ui_ue_spec.visual_constraints` 引用方式。

## 0.1.0 - 2026-06-20

- 新增 `design-system` skill，用于在 PiFlow `design` 阶段把 OpenDesign 或其他外部视觉参考归一化为项目级设计系统。
- 补充 `SKILL.md`、双语 README、版本文件、安装 wrapper 和 OpenAI/Codex agent metadata。
