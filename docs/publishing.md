# Publishing @cosborn2/ui

The root `package.json` owns the package version. Releases are public and MIT licensed. The [publish workflow](../.github/workflows/publish-ui.yml) validates the package and publishes through npm trusted publishing. Configure the account and repository prerequisites below before enabling it.

## Release a version

Choose the next version in a reviewed PR. Increment the prerelease identifier for beta releases, use patch versions for compatible fixes, and minor versions for new APIs. Before `1.0`, breaking changes require a new minor version; from `1.0` onward, use a new major version. Include migration notes for breaking changes. Documentation-only maintenance does not require publication.

Update `package.json`, run `bun install` to refresh the lockfile, and commit any resulting `bun.lock` changes. A version-only bump may leave the lockfile unchanged. After the required checks and review, squash merge the PR.

When a push to `main` changes `package.json` and `UI_NPM_PUBLISH_ENABLED` is `true`, the workflow checks the committed version against npm. A missing version proceeds through frozen installation, lint, build, unit tests, and the packed browser suite before publication. Prereleases use `beta`; stable releases use `latest`. Existing versions are skipped; registry failures stop the release. Confirm the workflow result and npm version/tag after publication.

The workflow does not choose versions, create Git tags or GitHub releases, or update consumer applications. Source changes without a version bump are not a new release.

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
bun run test
bunx playwright install chromium
UI_FIXTURE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bnh-ui-verify-XXXXXX")"
BNH_UI_FIXTURE_DIR="$UI_FIXTURE_DIR" BNH_UI_KEEP_FIXTURE=1 bun run test:browser
```

The browser command builds and packs the library, installs that tarball in isolated React/Next consumers, and checks SSR, browser behavior, exports, and size budgets. See the [fixture guide](../fixtures/README.md) for retained artifacts. Validate affected application integrations against the same artifact before publication. After checks pass, publish the tested tarball from the same shell:

```sh
UI_RELEASE_VERSION="$(node -p 'require("./package.json").version')"
UI_RELEASE_CHANNEL="$(node -p 'require("./package.json").version.includes("-") ? "beta" : "latest"')"
npm login
npm whoami
npm publish "$UI_FIXTURE_DIR/cosborn2-ui-$UI_RELEASE_VERSION.tgz" --access public --tag "$UI_RELEASE_CHANNEL" --provenance=false
npm view "@cosborn2/ui@$UI_RELEASE_VERSION" version
npm view @cosborn2/ui dist-tags --json
```

Complete npm's interactive authentication prompts locally. The manual bootstrap omits CI provenance; subsequent trusted publications from the public repository include it. Never assign a prerelease to `latest`.

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

Applications install a published version, commit their resulting lockfile, and verify frozen installation, tests, types, and production builds before merging the update. Test affected UI flows and bundle budgets. Template maintainers should also generate and verify a fresh application; existing generated applications need their own dependency updates.

Adopt beta releases and breaking changes explicitly with migration review. Dependency-update automation belongs to each consumer repository and must enforce its intended review policy. npm publication does not update installed applications or trigger an immediate dependency-update PR.

## Library dependency maintenance

Dependabot proposes grouped daily Bun updates and weekly GitHub Actions updates. Lucide is deliberately excluded from automatic updates because its pinned version is verified in React Server Components. Upgrade it manually after the SSR and size checks pass. Include a reviewed package version bump when a dependency change should ship.
