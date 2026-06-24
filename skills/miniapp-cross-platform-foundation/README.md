# Miniapp Cross-Platform Foundation

English documentation: [README.zh-CN.md](./README.zh-CN.md).

`miniapp-cross-platform-foundation` is a PiFlow miniapp foundation skill for Taro-first delivery.
It helps establish shared project structure, platform adapters, and conditional compilation before running platform-specific guidance.

## Install

Run the shared installer from the repository root:

```bash
node install.mjs miniapp-cross-platform-foundation
```

Or run the compatibility wrapper from this skill folder:

```bash
node install.mjs
```

## Use

This skill is designed to run in `codegen` unit composition with platform-specific miniapp skills:

- `client_target=miniapp` with `framework=taro` / `uni-app`
- `client_target=miniapp` with `framework=wechat-miniapp`
- `client_target=miniapp` with `framework=douyin-miniapp`
- `client_target=miniapp` with `framework=alipay-miniapp`

## Scope

Do:

- build shared layout/utility/component boundaries
- define cross-platform API adapters
- provide foundation-level quality and compliance checkpoints

Do not:

- decide release packaging flow
- perform direct platform deployment or audit submission
- bypass platform skill constraints

## Runtime integration with add-skill-lib

This skill is designed for PiFlow cataloging first and does not directly change live runtime wiring.

When users need real pipeline enablement:

1. Use `add-skill-lib` to sync this skill library and generate `skill.yaml` first.
2. Apply runtime wiring according to `references/piflow-runtime-integration.md`.

Default behavior stays catalog-only unless explicitly enabled in a user-allowed `piflow` profile.

## References

- `references/taro-stack.md`
- `references/framework-detection.md`
- `references/project-structure.md`
- `references/platform-adapters.md`
- `references/design-spec-contract.md`
- `references/conditional-compilation.md`
