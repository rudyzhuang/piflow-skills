---
name: miniapp-platform-douyin
description: Apply Douyin miniapp platform rules, API mapping, route constraints, and review points after the cross-platform foundation skill in PiFlow miniapp codegen.
---

# Miniapp Platform Douyin

## When to use

- Miniapp delivery target is Douyin.
- `client_target=miniapp` and `framework=tt` / `framework=douyin-miniapp`.
- Cross-platform foundation rules have been applied and platform deltas remain.

## Core rules

- Keep business logic platform-agnostic and place Douyin API calls in adapter layers.
- Follow Douyin lifecycle, page registration, and login/auth conventions from official docs.
- Ensure request, storage, and navigation capabilities map to `tt` namespace boundaries.
- Validate launch/performance and event reporting constraints before final merge.
- Keep permissions and user data handling explicit with minimal scope.

## Quality gates

- Validate Douyin `tt.request`, `tt.uploadFile`, and navigation entry points are used through adapters.
- Ensure `privacy`/`user agreement` references are reflected where required.
- Ensure test and self-check notes include:
  - login/auth path
  - storage scope boundaries
  - route and component lifecycle compatibility

## Runtime integration note (for add-skill-lib)

- This skill is companion-only: it should be paired with `miniapp-cross-platform-foundation`.
- It is catalog-first by default; do not enable implicitly in production pipelines.
- For runtime wiring details and unit composition, use:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
- Keep `add-skill-lib` as the entry path for metadata/bootstrap registration, then apply explicit `templates/skills-template.yaml` wiring when user requests runtime enablement.

## Reference usage

- `references/douyin-project.md`
- `references/douyin-api-adapter.md`
- `references/douyin-auth-privacy.md`
- `references/douyin-performance.md`
- `references/douyin-review-checklist.md`
