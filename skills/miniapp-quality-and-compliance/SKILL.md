---
name: miniapp-quality-and-compliance
description: Perform miniapp quality, privacy, permission, and release compliance checks (cross-platform + platform-specific) in PiFlow test stage or review passes.
---

# Miniapp Quality and Compliance

## When to use

- Miniapp implementation needs a final quality/compliance sweep.
- `client_target=miniapp` in `codegen`/`test` pass.
- Need a release-oriented checklist before merge.

## Scope

- Validate shared adapter boundaries are respected.
- Verify permission, privacy, and personal data handling logic.
- Validate compliance with platform-specific constraints for WeChat, Douyin, and Alipay.
- Check build/test evidence for miniapp scope and flag blockers explicitly.

## Required actions

- Generate a miniapp checklist artifact and include blocking/needs_human items explicitly.
- Check if any secret, `appid`, token, private key, or internal domain is hardcoded in component logic.
- Confirm that acceptance/test plans cover critical platform flows.

## Runtime integration note (for add-skill-lib)

- This skill is execution companion: typically appended in `test` unit when miniapp runtime quality/compliance evidence is needed.
- It is catalog-first by default; do not make it implicitly active in unknown project profiles.
- For runtime wiring details and unit composition, use:
  - `skills/miniapp-cross-platform-foundation/references/piflow-runtime-integration.md`
- Keep `add-skill-lib` as the entry path for metadata/bootstrap registration, then apply explicit `templates/skills-template.yaml` wiring when user requests runtime enablement.

## References

- `references/miniapp-compliance-checklist.md`
- `references/miniapp-test-matrix.md`
- `references/miniapp-privacy-audit-map.md`
- `references/miniapp-release-readiness.md`
