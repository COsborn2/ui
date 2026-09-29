# Contributing to @cosborn2/ui

Use pull requests for changes. Describe the user-visible result, compatibility impact, and validation. Discuss large API or dependency changes in an issue first. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Local setup

Use Node.js 26 and the Bun version in `.bun-version` (also declared in `package.json`). From the repository root:

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun run storybook
```

Before submitting a PR, run `bun run lint`, `bun run build`, `bun run test`, `bun run build-storybook`, and `bun run check:package`. `lint` includes type checking of the library, stories, tests, and tooling. Use the [testing guide](docs/testing.md) for focused tests and conventions. `bun run dev` watches library source and styles.

## Component changes

- Preserve granular JavaScript and CSS entry points. A small consumer must not inherit unrelated component, icon, or dialog code.
- Keep static components server-compatible. Add client boundaries only where interaction requires them, and preserve the published rendering boundaries.
- Support React applications without Tailwind. Import only the icons a component needs, and preserve scoped theme behavior.
- Test meaningful behavior changes, including keyboard navigation, focus restoration, nested dialogs/menus, and accessible names where relevant.
- Add or update Storybook examples and interaction tests for public behavior. Accessibility violations fail story tests; investigate them rather than disabling rules to make CI pass.
- Test controlled state, callbacks, disabled/loading states, native form behavior, and event/ref composition with React Testing Library. Assert observable behavior rather than React internals or markup snapshots.

Edit `tokens.json` for canonical theme changes; the build generates the packaged theme. Do not add application-specific services or styling dependencies. Lucide remains pinned; upgrades require deliberate review and component-test validation.

## Review and release

Pull requests require a passing, up-to-date `verify` check and resolved review conversations. Merges are squash-only. The main protection ruleset has no bypass; a separate review ruleset requires one approval, including code owner approval, and dismisses stale approvals. While there is one maintainer, repository administrators have a PR-only exception to the review rule so the owner can merge their own PRs without bypassing CI. Dependency automation also uses that review-only exception for verified dependency and generated version-only release PRs, after a commit-bound automated approval. Other PRs are not eligible for automated approval or merging. When independent reviewers are available, migrate automation to a dedicated identity before removing the administrator review exception. The [live rulesets](https://github.com/COsborn2/ui/rules) are the source of truth for enforcement.

Versions are committed through release PRs. Dependency automation proposes the next patch or beta increment after Bun dependency updates merge. Follow the version policy in the [publishing runbook](docs/publishing.md), update `package.json`, and commit any resulting lockfile changes. Documentation-only maintenance does not require a package release.

Publishing runs through the trusted workflow after a version PR merges. The runbook covers setup, dependency automation, and retries. Do not add npm credentials to the repository or PR.
