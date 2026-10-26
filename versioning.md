# Versioning

We maintain the stable `0.2.x` line on `main`. Older lines receive no updates.

## 1. Release everyday changes

1. Merge a PR into `main`.
2. After checks pass, CI publishes the next patch: `0.2.0` → `0.2.1` → `0.2.2`.

Eligible Dependabot updates merge and publish the same way. Changes only to docs, stories, tests, or GitHub Actions do not publish.

Do not edit the version in `package.json` or create release tags yourself. CI sets the published version; npm records and Git tags track the counter.

## 2. Start the next minor or major version

1. In the feature PR, change `release.json` from `"line": "0.2"` to `"line": "0.3"`. Keep `"channel": "stable"`.
2. Merge it. CI publishes `0.3.0` to npm’s `latest` tag; later changes publish `0.3.1`, `0.3.2`, etc.
3. Stop updating `0.2.x`. Consumers adopt the new version through their own dependency PRs.

For a major release, set `line` to `1.0`, then `2.0`, and so on.

## 3. Preview a future line, if needed

1. Set the next `line` and `"channel": "beta"` in a PR. Its merge publishes that line’s first beta.
2. To promote it, change only `channel` to `stable`. CI publishes the stable version to `latest`.

Only one line is maintained at a time; no beta or LTS branches are needed.

## 4. Check or retry a release

Check **Actions → Publish UI Package**. To retry, choose **Run workflow → main**. CI checks published history before creating a version and repairs interrupted tag/release creation.

Use `bun run release:preview` locally to see the proposed version without publishing. See [publishing setup](docs/publishing.md) for credentials and troubleshooting.
