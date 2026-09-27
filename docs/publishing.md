# Publishing and updating @cosborn2/ui

The library lives in the private `COsborn2/ui` repository and has its own version in the root `package.json`. Application and bnh-template both install the public npm package; neither hosts the library source. MIT is included. The `@cosborn2` npm organization is secured, but the first publication and account-side configuration must be completed before automatic releases work.

## 1. Publish the first beta once

Merge the standalone UI package PR in `COsborn2/ui` first, then use a clean checkout of that reviewed `main` commit. Keep [application #291](https://github.com/COsborn2/application/pull/291) and [bnh-template #168](https://github.com/COsborn2/bnh-template/pull/168) in draft until npm publication and their registry-backed lockfile checks are complete. Keep `UI_NPM_PUBLISH_ENABLED` unset until bootstrap is complete. Sign in to an npm account with publishing access to the organization and enable account 2FA. [npm scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

From the UI repository root, verify the release metadata and run the package checks:

```sh
bun install --frozen-lockfile
bun scripts/check-release.ts
bun run lint
bun run test
```

If Playwright Chromium is not installed, run `bunx playwright install chromium` from the UI repository root. Retain the browser fixture so publication uses the exact tarball it tested:

```sh
UI_FIXTURE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/bnh-ui-verify-XXXXXX")"
BNH_UI_FIXTURE_DIR="$UI_FIXTURE_DIR" BNH_UI_KEEP_FIXTURE=1 bun run test:browser
```

This builds and packs the library, installs the tarball in isolated React/Next consumers, and checks SSR, browser behavior, exports, and size budgets. The [fixture guide](../fixtures/README.md) explains the checks and retained artifacts. Validate both app integrations against the same artifact before publication, then finish their registry checks in step 4. After all checks pass, publish from the same shell:

```sh
npm login
npm whoami
npm publish "$UI_FIXTURE_DIR/cosborn2-ui-0.1.0-beta.0.tgz" --access public --tag beta --provenance=false
npm view @cosborn2/ui@0.1.0-beta.0 version
npm view @cosborn2/ui dist-tags --json
```

Complete npm's interactive authentication prompts locally. The beta tag should point to `0.1.0-beta.0`; do not assign this prerelease to `latest`. An already-published version cannot be replaced—use a new version for changed contents. The public package contains its compiled UI distribution, README, license, and metadata; it does not contain either application.

## 2. Enable automatic publication

In **COsborn2/ui → Settings → Environments**, create `npm-publish` and restrict its deployment branches to `main`. Leave required reviewers disabled if releases should proceed automatically after merge; enabling them deliberately adds a release approval.

After the package exists, open **npm → @cosborn2/ui → Settings → Trusted Publisher**, choose **GitHub Actions**, and enter these exact values:

| Field | Value |
| --- | --- |
| Organization or user | `COsborn2` |
| Repository | `ui` |
| Workflow filename | `publish-ui.yml` |
| Environment name | `npm-publish` |
| Allowed actions | Enable direct `npm publish` |

New npm trusted publishers default to staged publishing; direct publication must be allowed for this workflow. OIDC supplies temporary credentials, so no `NPM_TOKEN` secret is needed. `COsborn2/ui` is initially private: the workflow sets provenance to `false`; it enables provenance if the repository becomes public. Private repositories can use trusted publishing without provenance. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

Finally, in **COsborn2/ui → Settings → Secrets and variables → Actions → Variables**, create the repository variable `UI_NPM_PUBLISH_ENABLED` with the exact value `true`. This gate applies to automatic runs and manual retries. It does not itself trigger a release.

## 3. Release subsequent changes

Include the next UI version and updated root `bun.lock` in the reviewed PR. During this beta, use `0.1.0-beta.1`, `0.1.0-beta.2`, and so on. After real consumer verification, use `0.1.0` for the first stable release. Compatible fixes use patch increments; new APIs use minor increments. Before `1.0`, breaking changes also require a new minor version and migration notes. Keep package release notes in the PR, separate from Application's public product changelog.

The [publish workflow](../.github/workflows/publish-ui.yml) runs when a push to `main` changes the root `package.json`. It checks the exact committed version against npm, skips an already-published version, installs the frozen lockfile, runs lint, builds, runs package tests and the packed browser suite, then publishes. Prereleases use `beta`; stable releases use `latest`. Registry failures stop the release. A manifest edit without a new version does not republish an existing release.

The pipeline does not choose or bump versions, create Git tags/GitHub releases, or publish every source edit. Review and commit the version change as part of the release PR. To retry a failed release, use **Actions → Publish UI Package → Run workflow**, select `main`, and enter the exact committed version with its matching `beta` or `latest` channel. Once published, another run skips that version. Confirm the first automated release in the workflow log and npm package versions.

## 4. Complete both application PRs and update generated apps

After the first beta is public, finish application #291 and bnh-template #168 with a registry install from `apps/web` in each application repository:

```sh
bun add --exact @cosborn2/ui@0.1.0-beta.0
```

Commit each application repository’s resulting `bun.lock`, then verify frozen root installs, tests, lint/type checks, and production builds. Also generate and verify a fresh project from bnh-template. Keep both application PRs in draft and unmerged until these registry checks pass; then mark them ready for review. For subsequent beta updates, run the same command with the new explicit version; do not assume Dependabot will follow every prerelease or automatically merge it.

Both application repositories configure daily Bun Dependabot checks and receive dependency-update PRs that change their manifests and lockfiles. Their existing workflows enable auto-merge for updates reported as minor or patch. Keep `@cosborn2/ui` minor and major version updates excluded from Dependabot in both apps while its API is below `1.0`: make those updates explicitly and review migration notes. Compatible stable patch updates can use the existing automatic path. Revisit this exception at `1.0`. Check these one-time prerequisites in each application repository:

- **Settings → General → Pull Requests → Allow auto-merge** is enabled.
- Branch rules require the relevant CI checks before merging.
- The existing `DEPENDABOT_AUTOMERGE_PAT` Actions secret is available, with repository contents and pull-request write permissions for the identity that approves and merges Dependabot PRs. Configure it in GitHub; do not commit it or share it in chat.

Dependabot checks are scheduled, not an immediate callback from npm publication. Exact version pins can still be updated through its PRs. An npm release does not change already-installed applications, and updating bnh-template does not rewrite projects previously generated from it; those repositories need their own dependency updates and CI. [Dependabot configuration](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [GitHub auto-merge setup](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository)

## UI repository dependency maintenance

This repository opens grouped daily Bun dependency PRs and weekly GitHub Actions update PRs. Lucide is deliberately excluded from automated updates: its pinned release is verified to render icons in React Server Components. Upgrade it manually only after the RSC and per-component size checks pass. Dependency PRs do not change the UI package version automatically; include a reviewed version bump when a dependency change should ship. The UI repository does not need the applications’ Dependabot auto-merge secret to publish npm releases.
