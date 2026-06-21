# Cloudflare Provider

Cloudflare capabilities:

- Pages
- Workers
- D1
- R2
- KV
- Queues
- DNS and route reconciliation
- Workers secrets
- D1 migrations
- CORS
- Gateway routing

Required credential hints:

- `CLOUDFLARE_API_TOKEN` or `CF_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` or `CF_ACCOUNT_ID`

Real deployment must be explicitly authorized by PiFlow. When authorized, the adapter executes explicit project/provider commands from `deploy.cloudflare.commands`, `deploy.commands`, or `deploy.services[].deploy_command`. Use this for Wrangler, Terraform, or other Cloudflare-approved deployment CLIs. If no command is configured, the adapter returns `blocked` with a command-missing action instead of guessing a destructive operation.

Built-in command synthesis:

- Pages/static site: `artifact_path` or `cloudflare.dist_dir` plus `cloudflare.project_name`
- Workers/API/gateway: `cloudflare.entry` or `cloudflare.config` plus optional `cloudflare.script_name`
- D1 migrations: `cloudflare.database` plus `cloudflare.migrations_dir`
- Resources: `cloudflare.resources[]` with `type=kv|r2|queue|d1` and `name`
- Secrets/vars: `cloudflare.secrets[]`, `cloudflare.vars`, `cloudflare.allowed_origins`, `cloudflare.gateway_pages_origins`
- DNS: `cloudflare.dns_records[]` with `zone_id`, `type`, `name`, and `content`
- Workers routes/domains: `cloudflare.routes[]`, `cloudflare.custom_domains[]`
- Pages domains: `cloudflare.pages_domains[]`
