# Custom Provider

Custom providers must implement the same JSON request/result contract as built-in providers.

Minimum requirements:

- deterministic `validate`
- non-mutating `plan`
- explicit destructive authorization for `deploy`
- secret redaction
- actionable `blocked` results for missing tools or credentials
- service outputs compatible with PiFlow `deploy.outputs.services[]`
