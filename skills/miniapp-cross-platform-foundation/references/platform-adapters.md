# Platform Adapter Convention

Rules:

- Do not call `wx`, `tt`, `my` directly in shared components.
- Add thin wrappers in `src/platform/<platform>`.
- Keep request, auth, storage, location, media, payment entry points in adapter APIs.
- Add interface-level fallback and typed error shapes for each platform API contract.
