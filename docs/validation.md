# Standalone package validation

`@cosborn2/ui@0.1.0-beta.0` is maintained in the standalone `COsborn2/ui` repository. It owns its build configuration, fixture dependencies, CI, and release workflow. Component source, styles, tokens, and runtime exports are independent of consumer applications.

The MIT-licensed public npm package has not been published. The registry lookup for the first beta still returns 404. Local tarball installation verifies the package contents but does not replace the pending registry install and lockfile checks.

## Verified artifact

| Property | Value |
| --- | --- |
| Package | `@cosborn2/ui@0.1.0-beta.0` |
| Archive | `cosborn2-ui-0.1.0-beta.0.tgz` |
| Compressed archive | 32,863 bytes |
| Unpacked contents | 131,509 bytes |
| Archive files | 84 |
| SHA-256 | `ab14a1b90ef26a74b775d75ff4000f2df63ccda3d03e1ebe9a708917eaefd7a0` |

This identity applies to the tested archive. Editing packaged files or rebuilding after further changes requires a fresh artifact and verification; the still-unpublished version alone does not identify its contents.

## Standalone checks

- A frozen dependency install, lint/type checks, and the package build pass without any application checkout.
- Unit tests pass: **75 tests, 297 assertions**.
- The fresh packed consumer passes **58 browser tests**, covering plain React and production Next with Chromium.
- The consumer uses **Next 16.3.5**, **React 19.3.0**, and **Tailwind 4.3.3**. The plain React fixture imports no Tailwind styles.
- Tracked repository files and all 84 archive files were checked for legacy product names and internal application repository links; no matches remain.
- Packed export/declaration checks, Node SSR, React Server Components, hydration, component interaction, CSS isolation, and the existing size gates pass.

The tree-shaken, minified JavaScript measurements are **220 bytes gzip for Button** and **15,187 bytes gzip for Modal**, excluding the existing React/React DOM peers. Modal includes its reachable dialog/icon dependencies. These are isolated consumer measurements, not whole-application transfer sizes. Archive size is reported separately because tree shaking does not reduce the installed dependency distributions.

## Application integration

The application checks below used the preceding standalone archive (`008f1fbd36a1ff0870c3bf5344648a2eb564c592286b1d06d046dba111ab795f`). Its compiled distribution and package metadata match the current archive byte-for-byte; only the packaged README changed. Registry-backed lockfile validation remains pending:

| Consumer | Evidence |
| --- | --- |
| bnh-template | Installed distribution matches the current archive. Web tests pass: **72 tests, 146 assertions**. The scaffold regression passes **36 assertions**. Lint/type checks and the production build pass. Validation was recorded on source commit `0ae41b8`. |

[bnh-template #168](https://github.com/COsborn2/bnh-template/pull/168) remains draft until the first public beta can be installed normally and its real `bun.lock` regenerated and verified. Previously generated template projects require their own dependency updates.

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
