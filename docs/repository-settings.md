# Repository settings

This is the intended configuration for `COsborn2/ui`. GitHub Settings is the source of truth for what is currently enforced. These settings support a single maintainer while keeping CI mandatory for every PR.

## Main branch protection

Create two **Active** branch rulesets targeting the default branch (`main`). Keep them separate so the owner's review exception cannot bypass CI or the other main-branch protections.

| Ruleset | Requirements | Bypass |
| --- | --- | --- |
| Main protection | Pull request required, zero approvals in this ruleset, conversations resolved, `verify` required from **GitHub Actions**, branch up to date before merging, linear history, block force pushes and deletion | None |
| Required review | Pull request required, one approval, dismiss stale approvals when new commits are pushed, require code owner review | Repository administrators, **For pull requests only** |

`.github/CODEOWNERS` assigns all paths to `@COsborn2`. Contributor PRs need the maintainer's approval. The owner cannot approve their own PR and must explicitly use the review exception after CI passes. Once another maintainer can provide independent reviews, remove this bypass. Repository settings permissions can still change these rules; a bypass list does not constrain administrators' ability to edit repository settings.

## Pull requests and Actions

Under **Settings → General → Pull Requests**:

- Allow squash merging only; disable merge commits and rebase merging.
- Use the PR title and description as the default squash commit message.
- Enable automatic branch deletion and auto-merge. Auto-merge must still satisfy the applicable rules; the owner's review exception requires an explicit merge.

Under **Settings → Actions → General**:

- Use read-only default workflow token permissions and leave Actions PR creation/approval disabled.
- Require approval for workflow runs from outside collaborators.
- Require Actions to be pinned to full commit SHAs. Workflows already use SHA pins; Dependabot proposes updates.

Retain narrowly scoped permissions in workflows. The publish job requests `id-token: write` for npm OIDC; ordinary verification does not need it. Do not expose publication credentials to pull request workflows.

## Security and visibility

Enable Dependabot alerts and security updates, secret scanning and push protection, private vulnerability reporting, and CodeQL default setup for the supported languages. Review security alerts and update PRs rather than automatically dismissing them. The existing Dependabot configuration also proposes grouped dependency and Actions updates; Lucide upgrades remain manual because its Server Component behavior is verified at a pinned version.

Public visibility is the target. Before changing visibility, review the full Git history and Actions logs/artifacts for material that should not be published. Current documentation cleanup does not remove historical content. Resolve any historical references that should remain private before making the repository public; do not assume a squash merge erases them. This document does not assert that the visibility switch has already happened.

## npm publishing

Create the `npm-publish` environment with deployment branches restricted to **only `main`**. Leave required environment reviewers disabled so an approved and merged release can publish automatically. Configure npm's trusted publisher for `COsborn2/ui`, workflow `publish-ui.yml`, environment `npm-publish`, allowing direct publication.

Keep `UI_NPM_PUBLISH_ENABLED` unset or `false` until the first npm release and trusted publisher bootstrap are complete. The environment alone does not authorize publication, and changing repository visibility does not enable the publishing gate. After bootstrap, a reviewed version change merged to `main` can publish following the workflow's checks. See the [publishing runbook](publishing.md) for the exact sequence.
