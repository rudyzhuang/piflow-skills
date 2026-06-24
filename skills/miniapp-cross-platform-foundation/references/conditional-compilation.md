# Conditional Compilation Policy

- Prefer compile-time switches (supported by framework) for rendering and lifecycle differences.
- Avoid broad runtime branch logic in shared components.
- Keep compile guards near boundary adapters, not deep inside layout/business components.
