# Miniapp Platform WeChat

English documentation: [README.zh-CN.md](./README.zh-CN.md).

`miniapp-platform-wechat` complements foundation and applies WeChat-native implementation constraints in PiFlow miniapp codegen.

## Install

Run from repository root:

```bash
node install.mjs miniapp-platform-wechat
```

Or from local skill directory:

```bash
cd skills/miniapp-platform-wechat
node install.mjs
```

## Use

- `client_target=miniapp` and `framework=wechat-miniapp`.
- Often paired with `miniapp-cross-platform-foundation` in `codegen` units.

## Scope

- Check WeChat route, page, component and permission conventions.
- Verify privacy/authorization and review blockers.
- Avoid direct cross-platform API leakage by keeping `wx` calls in adapter boundaries.

## Runtime integration with add-skill-lib

This skill is a companion skill and defaults to catalog-only.

When user wants runtime activation:

1. Sync through `add-skill-lib` first so `skill.yaml` is generated.
2. Apply runtime wiring via `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`.
