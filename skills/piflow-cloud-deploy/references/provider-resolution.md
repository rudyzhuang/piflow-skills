# Provider Resolution

Provider resolution should stay deterministic and explainable.

Priority:

1. Explicit `request.provider`.
2. Explicit `deploy.provider`.
3. PiFlow-provided `provider_resolution.provider`.
4. `PIFLOW_CLOUD_PROVIDER` or `CLOUD_PROVIDER`.
5. Credential hint scoring from effective env.
6. Fallback to `manual`.

If two or more providers share the highest credential score, return `blocked` and ask the user to set an explicit provider.
