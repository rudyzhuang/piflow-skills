# Miniapp Quality and Compliance

English documentation: [README.zh-CN.md](./README.zh-CN.md).

`miniapp-quality-and-compliance` provides a final quality/compliance overlay for miniapp outputs in PiFlow.

## Install

Run from repository root:

```bash
node install.mjs miniapp-quality-and-compliance
```

Or run local wrapper:

```bash
cd skills/miniapp-quality-and-compliance
node install.mjs
```

## Use

- `client_target=miniapp` in `codegen`/`test`.
- Use in the same unit as miniapp codegen or as final release-readiness sweep.

## Scope

- Cross-platform miniapp adapter boundary checks.
- Permission/privacy/audit-readiness review.
- Platform-specific blocker collection (微信、抖音、支付宝).

## Runtime integration with add-skill-lib

- This is a test/quality companion skill and is catalog-only by default.
- For real runtime enablement, sync via `add-skill-lib` first, then apply `test` unit wiring guided by:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
