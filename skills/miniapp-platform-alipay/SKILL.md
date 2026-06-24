---
name: miniapp-platform-alipay
description: Apply Alipay mini program platform constraints, API differences, payment/auth paths, and release-review preparation after cross-platform foundation rules in PiFlow miniapp codegen.
---

# Miniapp Platform Alipay

## When to use

- Miniapp delivery target is Alipay.
- `client_target=miniapp` and `framework=alipay` / `framework=alipay-miniapp`.
- Foundation rules already prepared shared structure and adapter boundaries.

## Core rules

- Keep business logic out of platform entry points and route AliPay API calls via `src/platform/alipay`.
- Respect wallet/payment lifecycle and required user consent flow order.
- Validate app config, permission prompts, and API result handling in payment and user-info paths.
- Keep privacy declarations and data retention constraints explicit in design output.

## Quality gates

- Verify payment or identity-sensitive entry points include fallback and explicit error copy.
- Ensure no hardcoded secrets, appId-like identifiers, or raw certificate strings exist in component logic.
- Confirm launch/performance and review blockers before final merge.

## Runtime integration note (for add-skill-lib)

- This skill is companion-only: it should be paired with `miniapp-cross-platform-foundation`.
- It is catalog-first by default; do not enable implicitly in production pipelines.
- For runtime wiring details and unit composition, use:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
- Keep `add-skill-lib` as the entry path for metadata/bootstrap registration, then apply explicit `templates/skills-template.yaml` wiring when user requests runtime enablement.

## Reference usage

- `references/alipay-project.md`
- `references/alipay-api-adapter.md`
- `references/alipay-auth-privacy.md`
- `references/alipay-performance.md`
- `references/alipay-review-checklist.md`
