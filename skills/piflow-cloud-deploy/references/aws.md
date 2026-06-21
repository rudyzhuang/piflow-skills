# AWS Provider

AWS target capabilities:

- S3 and CloudFront static sites
- Lambda/API Gateway or App Runner APIs
- Route53 and ACM for custom domains
- Secrets Manager
- Health probes and rollback plans

Required credential hints:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

Real deployment must be explicitly authorized by PiFlow. When authorized, the adapter executes explicit project/provider commands from `deploy.aws.commands`, `deploy.commands`, or `deploy.services[].deploy_command`. Use this for AWS CLI, CDK, Terraform, SST, Amplify, or another project-approved deployment tool. If no command is configured, the adapter returns `blocked` with `aws_deploy_command_missing` instead of guessing a resource topology.

Built-in command synthesis:

- Static site: `artifact_path` plus `aws.bucket`; optional `aws.distribution_id` triggers CloudFront invalidation
- Lambda/API: `aws.function_name` plus `aws.zip_file` or `artifact_path`
- App Runner/container: `aws.service_arn` plus `aws.image_identifier`
