# Miniapp Platform Alipay

English documentation: [README.zh-CN.md](./README.zh-CN.md).

`miniapp-platform-alipay` complements `miniapp-cross-platform-foundation` and applies Alipay-specific release, payment, and privacy constraints in PiFlow miniapp codegen.

## Install

Run from repository root:

```bash
node install.mjs miniapp-platform-alipay
```

Or run local wrapper:

```bash
cd skills/miniapp-platform-alipay
node install.mjs
```

## Use

- `client_target=miniapp` and `framework=alipay` / `framework=alipay-miniapp`.
- Typically paired with `miniapp-cross-platform-foundation`.

## Scope

- Constrain `my` / Alipay APIs behind adapter boundaries.
- Validate payment/auth/retry logic and permission prompts.
- Keep privacy and review blockers visible in implementation notes.

## Runtime integration with add-skill-lib

- This is a companion skill and defaults to catalog-only.
- Enable only with explicit user authorization:
  1) `add-skill-lib` sync first (generate `skill.yaml`)
  2) follow `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md` for template wiring
