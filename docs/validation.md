# Standalone package migration validation

`@cosborn2/ui@0.1.0-beta.0` has been moved from the application workspace into the private `COsborn2/ui` repository. Component source, styles, tokens, and runtime exports are unchanged by this repository move. Build configuration, fixture paths, repository metadata, CI, and release documentation now work independently of either application.

The MIT-licensed public npm package has not been published. The registry lookup for the first beta still returns 404. Local tarball installation verifies the package contents but does not replace the pending registry install and lockfile checks.

## Verified artifact

| Property | Value |
| --- | --- |
| Package | `@cosborn2/ui@0.1.0-beta.0` |
| Archive | `cosborn2-ui-0.1.0-beta.0.tgz` |
| Compressed archive | 32,875 bytes |
| Unpacked contents | 131,520 bytes |
| Archive files | 84 |
| SHA-256 | `008f1fbd36a1ff0870c3bf5344648a2eb564c592286b1d06d046dba111ab795f` |

This identity applies to the tested archive. Editing packaged files or rebuilding after further changes requires a fresh artifact and verification; the still-unpublished version alone does not identify its contents.

## Standalone checks

- A frozen dependency install, lint/type checks, and the package build pass independently of application.
- Unit tests pass: **71 tests, 283 assertions**.
- The fresh packed consumer passes **58 browser tests**, covering plain React and production Next with Chromium.
- The consumer uses **Next 16.3.5**, **React 19.3.0**, and **Tailwind 4.3.3**. The plain React fixture imports no Tailwind styles.
- Packed export/declaration checks, Node SSR, React Server Components, hydration, component interaction, CSS isolation, and the existing size gates pass.

The tree-shaken, minified JavaScript measurements are **220 bytes gzip for Button** and **15,187 bytes gzip for Modal**, excluding the existing React/React DOM peers. Modal includes its reachable dialog/icon dependencies. These are isolated consumer measurements, not whole-application transfer sizes. Archive size is reported separately because tree shaking does not reduce the installed dependency distributions.

## Application integration

The applications were checked against this standalone archive, with registry-backed lockfiles still pending:

| Consumer | Evidence |
| --- | --- |
| bnh-template | Installed distribution matches the archive. Web tests pass: **72 tests, 146 assertions**. The scaffold regression passes **36 assertions**. Lint/type checks and the production build pass. Validation was recorded on source commit `0ae41b8`. |
| Application | All **84 archive files** match the installed package. Web tests pass: **619 tests, 2,231 assertions**. Root lint/type checks across **10 workspaces**, theme synchronization, the icon check, and the final production build pass. |

[application #291](https://github.com/COsborn2/application/pull/291) and [bnh-template #168](https://github.com/COsborn2/bnh-template/pull/168) remain draft until the first public beta can be installed normally and each real `bun.lock` regenerated and verified. Previously generated template projects require their own dependency updates.

## Reproduce and retain evidence

From this repository root:

```sh
bun install --frozen-lockfile
bun run lint
bun run build
bun run test
bunx playwright install chromium
BNH_UI_KEEP_FIXTURE=1 bun run test:browser
```

The browser command includes the packed-package checks and prints the temporary fixture location. Retaining it preserves the exact tarball, report, compiled bundle graphs, browser screenshots, and production consumer logs. See the [fixture guide](../fixtures/README.md) for supported reuse options and the [publishing runbook](publishing.md) for first-publication and consumer-update steps.

No npm credentials, registry publication, or account-side trusted-publisher configuration were changed during these checks. The automatic pipeline remains gated until bootstrap is complete.
