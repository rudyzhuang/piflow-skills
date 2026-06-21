# GCP Provider

GCP target capabilities:

- Cloud Run APIs
- Cloud Storage or Firebase Hosting static sites
- Cloud DNS
- Secret Manager
- Health probes and rollback plans

Required credential hints:

- `GCP_PROJECT_ID`
- `GCP_SERVICE_ACCOUNT_KEY_JSON`

Real deployment must be explicitly authorized by PiFlow. When authorized, the adapter executes explicit project/provider commands from `deploy.gcp.commands`, `deploy.commands`, or `deploy.services[].deploy_command`. Use this for `gcloud`, Firebase CLI, Terraform, or another project-approved deployment tool. If no command is configured, the adapter returns `blocked` with `gcp_deploy_command_missing` instead of guessing a resource topology.

Built-in command synthesis:

- Cloud Run/API/container: `gcp.service` plus `gcp.image`; optional `gcp.region`
- Firebase/static site: `artifact_path` plus `gcp.firebase_project` or `gcp.project_id`
- GCS: `artifact_path` plus `gcp.bucket`
