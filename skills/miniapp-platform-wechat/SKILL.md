---
name: miniapp-platform-wechat
description: Apply WeChat miniapp platform-specific constraints, APIs, config, and privacy/review checks after cross-platform foundation rules in PiFlow miniapp codegen.
---

# Miniapp Platform WeChat

## When to use

- Miniapp delivery target is WeChat.
- `client_target=miniapp` and `framework=wechat-miniapp` in codegen context.
- Foundation rules require platform-specific policy supplementation.

## Core rules

- Keep shared logic on foundation path and only use `wx` APIs through platform boundary.
- Use official WeChat conventions for page/component config, lifecycle hooks, and navigation entry points.
- Permission prompts must be user-justified and delayed until actual use.
- Privacy statement and permission rationale should be generated as part of doc checklist.
- Validate network/security boundaries and avoid unsafe user data retention.
- For performance, control launch cost and list rendering strategy to reduce frame drops.

## Quality gates

- Verify app settings and page metadata are complete for compilation target.
- Verify no direct network or key hardcoding in component files.
- Report privacy/authorization and review blockers before final merge.

## Runtime integration note (for add-skill-lib)

- This skill is companion-only: it should be paired with `miniapp-cross-platform-foundation`.
- It is catalog-first by default; do not enable implicitly in production pipelines.
- For runtime wiring details and unit composition, use:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
- Keep `add-skill-lib` as the entry path for metadata/bootstrap registration, then apply explicit `templates/skills-template.yaml` wiring when user requests runtime enablement.

## Reference usage

- `references/wechat-project.md`
- `references/wechat-api-adapter.md`
- `references/wechat-auth-privacy.md`
- `references/wechat-performance.md`
- `references/wechat-review-checklist.md`
