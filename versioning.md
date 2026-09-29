# Versioning

We maintain one release line on `main`. No beta or LTS branches are needed.

## 1. Release everyday changes

Merge a PR into `main`. After checks pass, CI publishes automatically:

- Beta: `0.1.0-beta.1` → `0.1.0-beta.2`.
- Stable: `0.1.0` → `0.1.1` → `0.1.2`.

Dependabot updates follow the same process. Eligible updates merge automatically after checks pass. Changes only to docs, stories, tests, or GitHub Actions do not publish.

Do not edit the version in `package.json` or create release tags yourself. CI sets the published version; npm records and Git tags track the counter.

## 2. Promote beta to stable

1. In a PR, change `release.json` from `"channel": "beta"` to `"channel": "stable"`.
2. Merge it. CI publishes `0.1.0` to npm's `latest` channel.
3. Later package changes automatically publish `0.1.1`, `0.1.2`, etc.

## 3. Start the next minor version

1. In the PR containing the new features or breaking changes, change `"line": "0.1"` to `"line": "0.2"` in `release.json`. Keep `"channel": "stable"`.
2. Merge it. CI publishes `0.2.0`; later changes publish `0.2.1`, `0.2.2`, etc.
3. Stop updating `0.1.x`. Repeat for `0.3`, `0.4`, and so on.

Old versions remain installable but receive no fixes. Consumers update their own dependencies.

## 4. Check or retry a release

Check **Actions → Publish UI Package**. To retry, choose **Run workflow → main**. CI checks published history before creating a version and repairs interrupted tag/release creation.

Use `bun run release:preview` locally to see the proposed version without publishing. See [publishing setup](docs/publishing.md) for credentials and troubleshooting.
