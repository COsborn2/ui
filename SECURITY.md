# Security policy

## Reporting a vulnerability

Report suspected vulnerabilities privately through [GitHub's private vulnerability reporting form](https://github.com/COsborn2/ui/security/advisories/new). Do not put sensitive details, credentials, or exploit instructions in a public issue or pull request.

Include the affected package version, a minimal reproduction, expected impact, and any relevant environment details. Use synthetic data and remove secrets from attachments. The maintainer will investigate and coordinate a fix and disclosure through the private report. This project currently has one maintainer and does not promise a response deadline.

## Supported versions

This project maintains one release line on `main`. Before the first stable release, security fixes target the newest beta. After a stable release is available, fixes target the newest stable version. Consumers must upgrade to that version to receive fixes; older betas and stable release lines do not receive backports. For example, once `0.2.x` is the current stable line, `0.1.x` is no longer supported.

Report a vulnerability even if you are unsure whether your version is affected.

## Dependency maintenance

Dependabot proposes routine version updates for the maintained release line. Its Bun integration currently supports version updates, not advisory-triggered security updates. Maintainers can run `bun audit` locally when investigating dependency vulnerabilities; audits are not required CI or publishing checks.

Registry advisories complement private reports and security review. Report suspected vulnerabilities through the private form above.
