# Publishing @cosborn2/ui

The root `package.json` owns the package version. Releases are public and MIT licensed. The [publish workflow](../.github/workflows/publish-ui.yml) validates the package and publishes through npm trusted publishing. Configure the account and repository prerequisites below before enabling it.

## Release a version

Choose the next version in a reviewed PR. Dependency maintenance can generate these version PRs automatically, as described below. Increment the prerelease identifier for beta releases, use patch versions for compatible fixes, and minor versions for new APIs. Before `1.0`, breaking changes require a new minor version; from `1.0` onward, use a new major version. Include migration notes for breaking changes. Documentation-only maintenance does not require publication.

Update `package.json`, run `bun install` to refresh the lockfile, and commit any resulting `bun.lock` changes. A version-only bump may leave the lockfile unchanged. After the required checks and review, squash merge the PR.

When a push to `main` changes `package.json` and `UI_NPM_PUBLISH_ENABLED` is `true`, the workflow checks the committed version against npm. A missing version proceeds through frozen installation, lint, build, React unit tests, Storybook interaction/accessibility tests, the documentation build, and npm contents/exports checks before publication. The workflow requests `beta` for prereleases and `latest` for stable releases; see the first-publication caveat below. Existing versions are skipped; registry failures stop the release. Confirm the workflow result and npm version/tag after publication.

The publish workflow does not choose versions, create Git tags or GitHub releases, or update consumer applications. The separate dependency-release workflow proposes version changes through PRs. Source changes without a version bump are not a new release.

## Retry a release

Use **Actions → Publish UI Package → Run workflow**, select `main`, and enter the exact version committed in `package.json` with its matching `beta` or `latest` channel. The same checks and publishing gate apply. A published version is skipped and cannot be overwritten; changed package contents require a new version.

## Initial setup and recovery

Use this section when creating the npm package or restoring its publishing configuration. Keep the repository variable `UI_NPM_PUBLISH_ENABLED` unset or `false` until setup is complete. The gate applies to automatic runs and manual retries.

### Create the npm package if it does not exist

Use a clean checkout of reviewed `main` and an npm account with publishing access to the `cosborn2` organization and 2FA enabled. From the repository root:

```sh
bun install --frozen-lockfile
bun scripts/check-release.ts
bun run lint
bun run build
bunx playwright install chromium
bun run test
bun run build-storybook
bun run check:package
```

These commands validate component behavior, accessibility, types, documentation, and published files. See the [testing guide](testing.md). After checks pass, pack the already-built distribution without rebuilding and publish it from the same shell:

```sh
UI_RELEASE_VERSION="$(node -p 'require("./package.json").version')"
UI_RELEASE_CHANNEL="$(node -p 'require("./package.json").version.includes("-") ? "beta" : "latest"')"
UI_RELEASE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ui-release-XXXXXX")"
npm pack --ignore-scripts --pack-destination "$UI_RELEASE_DIR"
npm login
npm whoami
npm publish "$UI_RELEASE_DIR/cosborn2-ui-$UI_RELEASE_VERSION.tgz" --access public --tag "$UI_RELEASE_CHANNEL" --provenance=false
npm view "@cosborn2/ui@$UI_RELEASE_VERSION" version
npm view @cosborn2/ui dist-tags --json
```

Complete npm's interactive authentication prompts locally. The manual bootstrap omits CI provenance; subsequent trusted publications from the public repository include it.

On a package's first publication, npm may also assign `latest` despite an explicit `--tag beta`, and reject removing that tag ([npm CLI issue #8490](https://github.com/npm/cli/issues/8490)). Inspect the tags after publication. If both point to the first beta, leave them until the first reviewed stable release replaces `latest`; do not publish a placeholder version to change this state. Consumers should pin an explicit beta version until a stable release is available.

### Configure trusted publishing

In **GitHub → COsborn2/ui → Settings → Environments**, ensure `npm-publish` permits deployments from only the `main` branch. Leave required environment reviewers disabled for automatic releases after merge; enabling reviewers adds a separate release approval.

In **npm → @cosborn2/ui → Settings → Trusted Publisher**, choose **GitHub Actions** and enter:

| Field | Value |
| --- | --- |
| Organization or user | `COsborn2` |
| Repository | `ui` |
| Workflow filename | `publish-ui.yml` |
| Environment name | `npm-publish` |
| Allowed actions | Enable direct `npm publish` |

Direct publishing must be allowed because this workflow uses `npm publish`. OIDC provides temporary credentials, so no `NPM_TOKEN` secret is needed. The workflow enables provenance for a public repository and disables it for a private repository. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for account-side requirements.

In **GitHub → COsborn2/ui → Settings → Secrets and variables → Actions → Variables**, set the **repository variable** `UI_NPM_PUBLISH_ENABLED` to exactly `true`. It is not a secret or an environment variable. Changing it does not trigger a release; use the retry procedure for an unpublished version already on `main`.

## Consumer updates

Applications install a published version, commit their resulting lockfile, and verify frozen installation, tests, types, and production builds before merging the update. Test affected UI flows and each application's own required checks. Template maintainers should also generate and verify a fresh application; existing generated applications need their own dependency updates.

Pin beta dependencies to an exact version, such as `@cosborn2/ui@0.1.0-beta.0`; `latest` is not a stability guarantee before the first stable release. Adopt beta releases and breaking changes explicitly with migration review. Dependency-update automation belongs to each consumer repository and must enforce its intended review policy. npm publication does not update installed applications or trigger an immediate dependency-update PR.

## Library dependency maintenance

Dependabot checks Bun dependencies daily and GitHub Actions weekly. The dependency automation approves and squash merges eligible minor/patch updates after the component CI workflow passes for the exact current PR commit. Major upgrades, prerelease dependencies, pre-1.0 minor upgrades, and unclassified changes require manual review. Lucide remains deliberately pinned for server-compatible icons; upgrade it manually after compatibility review.

After a Bun dependency update merges, the dependency-release workflow opens or refreshes one version-only PR. Stable versions advance one patch (`1.2.3` → `1.2.4`); beta versions advance their existing beta sequence (`0.1.0-beta.1` → `0.1.0-beta.2`). Automation never promotes a beta to stable. The release PR passes the normal checks, receives an automated approval, and is squash merged automatically after its version-only contents and dependency provenance are verified. That version change triggers the existing trusted npm publisher. GitHub Actions-only changes do not publish a new npm package.

A pending release PR is refreshed against current `main`; a maintainer version bump supersedes it. Publication remains idempotent through the existing exact-version registry check. Consumer applications still adopt versions independently.

### Enable dependency automation

Create an expiring, repository-scoped GitHub token owned by `COsborn2` with Contents and Pull requests read/write permissions. Include Workflows write permission to merge GitHub Actions pin updates. The approval policy trusts only the repository owner as the generated release author. Store it as the Actions repository secret `DEPENDABOT_AUTOMERGE_PAT`; never put the token in a file, PR, or chat. This identity creates release PRs and performs eligible squash merges so GitHub can trigger CI, release preparation, and publishing normally. The built-in `GITHUB_TOKEN` supplies approvals. Using `GITHUB_TOKEN` for merges would suppress downstream push workflows; see [GitHub token behavior](https://docs.github.com/en/actions/concepts/security/github_token).

In **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests** while keeping the default token permissions read-only. Keep one required approval, mandatory CODEOWNER review, stale-review dismissal, strict required checks, and squash-only merges.

GitHub scopes ruleset exceptions to the identity performing a merge, not the PR author. The separate review ruleset already gives repository administrators a PR-only exception for this single-maintainer repository. Dependency automation uses that existing exception through the owner token only after validating an eligible Dependabot PR or its generated release PR. This restriction is enforced by the workflow; the token itself retains the owner's review exception. Ordinary code PRs never qualify for automated approval or merging. The main protection ruleset has no bypass, so required CI, up-to-date checks, resolved conversations, and squash-only merges remain enforced by GitHub. See [GitHub ruleset bypass permissions](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository#granting-bypass-permissions-for-your-branch-or-tag-ruleset).

The workflow performs a direct squash merge tied to the validated head SHA after checks pass; it does not leave a persistent auto-merge request that could apply to later commits. At the final recheck, a changed head or base, missing approval, or outstanding request for changes stops the merge. GitHub enforces the head SHA atomically; review state has no equivalent atomic condition and is checked immediately before submission. To separate automation from the maintainer identity later, use a dedicated GitHub App with repository-scoped permissions and a review-only bypass, and update the trusted release-author policy. Keep the main protection ruleset without bypasses.

Both privileged workflows operate on trusted base/main code and API metadata. They never install or execute a dependency PR's code. The approval guard verifies the author, same-repository branch, commit ownership, changed files and versions, and exact head SHA; generated releases must be a proven version-only change. Missing credentials or an invalid policy check stop automation.

Merge the workflow changes to `main` before expecting them to run. Eligible PRs are reconsidered when their component CI workflow completes successfully. Use **Actions → Dependency approvals and merges → Run workflow** on `main` with a PR number to retry its policy check after CI passes. Use **Actions → Prepare Dependency Release → Run workflow** on `main` to reconcile a pending dependency release if necessary.
