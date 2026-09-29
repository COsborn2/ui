# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through [GitHub's private vulnerability reporting form](https://github.com/COsborn2/ui/security/advisories/new). Do not put sensitive details, credentials, or exploit instructions in a public issue or pull request.

Include the affected package version, a minimal reproduction, expected impact, and any relevant environment details. Use synthetic data and remove secrets from attachments. The maintainer will investigate and coordinate a fix and disclosure through the private report. This project currently has one maintainer and does not promise a response deadline.

## Supported versions

This project maintains one release line on `main`. Before the first stable release, security fixes target the newest beta. After a stable release is available, fixes target the newest stable version. Consumers must upgrade to that version to receive fixes; older betas and stable release lines do not receive backports. For example, once `0.2.x` is the current stable line, `0.1.x` is no longer supported.

Report a vulnerability even if you are unsure whether your version is affected.

## Dependency checks

The Dependency Security workflow runs on pull requests, pushes to `main`, daily, and on demand. It runs `bun audit --audit-level=high` against the complete `bun.lock`, including development dependencies, without installing packages or executing dependency scripts. High and critical advisories and audit failures fail the check. Lower-severity findings can still be inspected locally with `bun audit`.

These checks use registry advisories and do not replace private reports or security review. Dependabot proposes routine version updates; the scheduled audit also checks for newly disclosed vulnerabilities between updates.
