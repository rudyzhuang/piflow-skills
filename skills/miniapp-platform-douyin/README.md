# Miniapp Platform Douyin

English documentation: [README.zh-CN.md](./README.zh-CN.md).

`miniapp-platform-douyin` complements `miniapp-cross-platform-foundation` and applies Douyin-specific implementation constraints in PiFlow miniapp codegen.

## Install

Run from repository root:

```bash
node install.mjs miniapp-platform-douyin
```

Or run local wrapper:

```bash
cd skills/miniapp-platform-douyin
node install.mjs
```

## Use

- `client_target=miniapp` and `framework=tt` / `framework=douyin-miniapp`.
- Usually used together with `miniapp-cross-platform-foundation` in `codegen` units.

## Scope

- Constrain Douyin `tt` API usage to adapter boundaries.
- Verify route, page config, auth/privacy, performance, and review items.
- Keep cross-platform code generic and only branch by platform adapter.

## Runtime integration with add-skill-lib

- This is a companion skill and defaults to catalog-only.
- For runtime enablement, sync with `add-skill-lib` first, then apply `templates/skills-template.yaml` mapping according to:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
