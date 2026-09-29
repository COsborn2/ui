# Publishing @cosborn2/ui

For everyday releases, follow [versioning.md](../versioning.md). This page covers the pipeline and account setup.

## Pipeline

Only `main` publishes. `release.json` selects the maintained line and beta/stable channel. Published npm versions and matching Git tags supply the counter; `package.json` deliberately keeps a development placeholder. release-it updates it only in the publishing checkout, publishes through npm OIDC, and creates a Git tag and GitHub release. No version commits, release PRs, or writes to the main branch are needed.

The workflow checks vulnerabilities, lint/types, library build, React unit tests, Storybook interactions/accessibility, Storybook build, and npm package contents before publication. Source, styles, runtime build inputs, and dependency changes publish the next beta or patch. A line/channel change explicitly starts a minor/major or stable release. Other maintenance alone does not publish.

Releases are serialized. Stale main runs skip publication; the newer run includes outstanding package changes. Registry errors stop publication. A retry verifies npm's source commit against Git before repairing missing tags/releases, then publishes only if more package changes exist. Conflicting tags or missing source history fail instead of being overwritten.

The original `0.1.0-beta.0` was published from a tarball without source metadata or a Git tag. It is the sole legacy bootstrap exception; the first automated release advances to `0.1.0-beta.1` and records its actual commit.

## Trusted publishing setup

Keep **Settings → Environments → npm-publish** restricted to `main`. Environment approval reviewers would add a manual approval to each release.

In **npm → @cosborn2/ui → Settings → Trusted Publisher**, configure:

| Field | Value |
| --- | --- |
| Organization or user | `COsborn2` |
| Repository | `ui` |
| Workflow filename | `publish-ui.yml` |
| Environment name | `npm-publish` |
| Allowed action | Direct `npm publish` |

Set the GitHub Actions **repository variable** `UI_NPM_PUBLISH_ENABLED` to `true`. OIDC provides temporary npm credentials; no `NPM_TOKEN` is needed. Node 26 supplies a compatible npm CLI. Provenance is enabled for a public repository. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

The publishing job needs `contents: write` for release tags and GitHub releases, and `id-token: write` for npm. It cannot bypass the protected main branch and never pushes a version commit.

## Dependency automation

Dependabot checks Bun dependencies daily and GitHub Actions weekly. Verified compatible updates can receive automated approval and an exact-head squash merge after required CI passes. Major upgrades, prerelease dependencies, pre-1.0 minor upgrades, Lucide, and broader contract changes require review. GitHub Actions updates do not publish npm releases.

Store an expiring, repository-scoped token owned by `COsborn2` in the Actions secret `DEPENDABOT_AUTOMERGE_PAT`. It needs Contents and Pull requests read/write; Workflows write is needed for action updates. The token is used only for the final merge, so GitHub triggers the subsequent publishing workflow. It is not an npm credential.

Enable **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests**, keeping default token permissions read-only. The built-in Actions token supplies the commit-bound approval.

The trusted-main workflow checks signed Dependabot metadata, allowed file/version changes, successful CI for the current commit, review objections, and current branch state. It does not execute PR code or install its dependencies with privileged credentials. Human PRs and version-only release PRs are ineligible.

The owner token uses the existing administrator review-only PR exception. The core protection ruleset has no bypass: strict required CI, resolved conversations, and squash-only merges remain enforced. A changed head/base or outstanding changes request stops the merge. Head matching is atomic; review state is rechecked immediately before submission. A dedicated GitHub App can replace the owner token later.

Bun currently supports Dependabot version updates but not advisory-triggered security updates. The **Dependency Security** workflow audits the lockfile daily and on PRs/main; the same high/critical vulnerability check gates required `verify` and publishing. Failures need investigation and a dependency-fix PR; they are not silently dismissed. Older release lines are not scanned or maintained.

## Retry and investigate

- Publication: **Actions → Publish UI Package → Run workflow → main**. There are no version or channel inputs.
- Dependabot merge: **Actions → Dependency approvals and merges → Run workflow → main**, then enter the PR number after CI passes.
- Vulnerability scan: **Actions → Dependency Security → Run workflow → main**.
- Conflicting npm/tag history: stop and investigate the recorded source commits. Never delete tags or republish an existing version to force a retry.

Consumers adopt releases through their own dependency PRs, lockfiles, and tests. Publication does not update installed applications. Pin beta versions explicitly; use `latest` only after the first stable release.
