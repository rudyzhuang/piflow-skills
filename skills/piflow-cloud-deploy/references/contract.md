# Cloud Deploy Contract

PiFlow calls this skill with `api_version=piflow.cloud.deploy/v1`.

Required request fields:

- `api_version`
- `operation`: `validate`, `plan`, `deploy`, `probe`, `finalize`, `rollback`, or `doctor`

Important optional fields:

- `provider`
- `project_root`
- `config_name`
- `effective_env`
- `deploy`
- `smoke`
- `services`
- `artifacts`
- `run_context`

Result fields:

- `api_version`
- `provider`
- `operation`
- `status`
- `services`
- `actions`
- `user_actions`
- `metadata`
- optional `failure_context`

Use `status=blocked` for missing credentials, ambiguous provider detection, missing tools, unsupported real deployment, or missing destructive authorization.
