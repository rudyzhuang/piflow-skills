---
name: miniapp-cross-platform-foundation
description: Use for React + TypeScript + Taro miniapp projects in PiFlow codegen and test stages to establish a shared cross-platform foundation before applying platform-specific rules.
---

# Miniapp Cross-Platform Foundation

## When to use

- Miniapp projects requiring WeChat / Douyin / Alipay delivery from a single design/spec source.
- `client_target=miniapp` or feature manifests that describe multiple miniapp destinations.
- Before applying platform-specific platform skill constraints.

## Core goal

Build a stable shared base for miniapp delivery with `Taro` first:

```text
design-spec.yaml -> React/TSX -> taro build -> weapp / tt / alipay
```

This skill should not decide release, upload, or audit details.

## Required actions

- Detect framework type from project context (`taro`, `uni-app`, or native miniapp).
- Normalize the shared structure for `src/pages`, `src/components`, `src/utils`, `src/platform`, `src/store`, `package.json`.
- Keep business logic platform-agnostic and route platform calls through `src/platform/<platform>` adapters.
- Use framework conditional compile or official adapter abstractions instead of repeated runtime branching.
- Standardize environment/config injection and API host constants as shared contracts.
- Ensure build matrix can switch between targets with `taro build --type weapp|tt|alipay`.
- Block direct hard-coded secrets (`appid`, token, key, secret, private URL) in component logic.

## Mandatory conventions

- Use English file names and lowercase directories.
- Keep one shared implementation for each feature; avoid copy-paste platform duplicates unless behavior truly differs.
- Public pages, components, APIs, and events should be described by shared contracts.
- If platform policy or API mismatch appears, pause and route to platform skill for explicit handling.
- In test stage, report cross-platform gaps and pre-flight checks for permission, privacy, and package health.

## Runtime integration note (for add-skill-lib)

- This skill is catalog-first and should not trigger release/review/upload actions by default.
- Enable this skill in `piflow` runtime only when the user explicitly requests miniapp codegen runtime composition.
- Use `references/piflow-runtime-integration.md` as the single source for runtime wiring (catalog + unit + test composition).
- Prefer `add-skill-lib` first to sync the library and generate `skill.yaml`, then apply runtime wiring updates in a separate explicit step.

## References

Load only when needed:

- `references/taro-stack.md`
- `references/framework-detection.md`
- `references/project-structure.md`
- `references/platform-adapters.md`
- `references/design-spec-contract.md`
- `references/conditional-compilation.md`
