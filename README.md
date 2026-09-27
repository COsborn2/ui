# @cosborn2/ui

React 19 components for web applications: controls, glass surfaces, accessible dialogs, and settings layouts. MIT licensed. ESM with TypeScript declarations.

The package works without Tailwind, a theme provider, Next.js, or a CSS-in-JS runtime. Import each component and its CSS explicitly. There is intentionally no root JavaScript barrel.

## Install and render a button

Install the `beta` tag or an explicit version for prereleases. Stable releases use the default `latest` tag.

```sh
npm install @cosborn2/ui@beta react react-dom
```

```tsx
import '@cosborn2/ui/theme.css';
import '@cosborn2/ui/button.css';
import { Button } from '@cosborn2/ui/button';

export function SaveButton() {
  return <Button type="submit">Save changes</Button>;
}
```

In Next App Router, the example can run as a Server Component. Event handlers belong in a client component; native form submission does not require an event handler. Button preserves the native default `type="submit"`, so specify `type="button"` for non-submit actions inside forms.

Import `theme.css` once, normally at the app's CSS entry or root layout. Import component styles there or alongside the component's app-owned adapter. JS entry points contain no CSS imports, so they also work with plain Node SSR. `all.css` is available when intentionally loading every component's styles; prefer individual styles for small consumers.

## Components and rendering boundaries

Each entry exports its prop types. Every entry has a matching `.css` export.

| Entry | Exports | Rendering |
| --- | --- | --- |
| `button` | `Button`, `buttonClassName` for anchors/router links | Server-compatible |
| `icon-button` | `IconButton` | Server-compatible |
| `ghost-text-button` | `GhostTextButton` | Server-compatible |
| `input`, `select` | `Input`, native `Select` | Server-compatible |
| `switch` | `Switch` (native checkbox) | Server-compatible |
| `skeleton` | `Skeleton` | Server-compatible |
| `pill` | `Pill` | Server-compatible |
| `surface` | `Surface` | Server-compatible |
| `glass-popover-surface` | `GlassPopoverSurface` | Server-compatible |
| `header-shell` | `HeaderShell`, padding constants | Server-compatible |
| `data-table` | `DataTable`, typed columns, loading/empty states | Server-compatible; callbacks require a client caller |
| `pagination` | `Pagination`, `PAGE_SIZE` | Server-compatible links; callbacks require a client caller |
| `settings` | `SettingsLayout`, `SettingsPageHeader`, `SettingsCard`, `SettingsCardHeader`, `SettingsRow`, `SettingsSection`, `SettingsNavigation` | Server-compatible |
| `settings-rail` | `SettingsRail` | Client boundary for callback navigation |
| `expandable-pill` | `ExpandablePill` | Client boundary |
| `segmented-control` | `SegmentedControl` | Client boundary |
| `theme-toggle`, `color-picker` | Controlled `ThemeToggle`, configurable `ColorPicker` | Client boundaries |
| `notice` | `Notice` with neutral/success/danger tones and optional heading/icon/actions | Server-compatible |
| `toast` | Controlled `Toast`, `ToastViewport` presentation | Server-compatible; handlers require a client caller |
| `actions-menu` | `ActionsMenu`, typed actions | Client boundary |
| `modal`, `confirm-dialog` | `Modal`, `ConfirmDialog` | Client boundary |

“Server-compatible” means the same component can be imported into a Server Component or ordinary client React code. It does not prohibit client use or imply a `server-only` dependency. Interactive entries preserve their own `"use client"` directives in the published modules. No page-wide client wrapper is required.

`DataTable` renders native table markup. Supply `getRowKey` for stable row identity, `caption` for a visible accessible table name, and `columns` with cell render functions. Static cell render functions execute on the server. For row actions, prefer links/buttons in cells; optional `onRowClick` supports Enter/Space activation when used inside a client component. Optional `onRowIntent(row)` runs on pointer entry or focus within a row, allowing the application to prefetch details. These callbacks require a client caller; static tables add no row event handlers when the callbacks are omitted.

`Pagination` renders real navigation links with `getPageHref={(page) => "/records?page=" + page}` and works without JavaScript. For local state, pass `onPageChange` from a client component instead. Page indexes start at zero; `pageSize` defaults to 20. Both components import only their own supporting styles through their matching CSS entry.

`ThemeToggle` accepts `value` (`system`, `light`, or `dark`) and `onChange`; it does not read storage or change document attributes. `ColorPicker` accepts `value`, `onChange`, and a `colors` array of `{ value, label, disabled? }`. Its optional empty selection returns `null`; set `allowNone={false}` to omit it. These controls expose accessible labels/selection and never submit an enclosing form. The application owns persistence and its color palette.

## Notices, menus, and notifications

`Notice` displays inline feedback with `tone="neutral"`, `"success"`, or `"danger"`. It accepts `heading`, decorative `icon`, `actions`, children, and native div attributes/ref. Static notices do not announce themselves. Choose `role="alert"` for an urgent form error or `role="status"` for a polite update when appropriate. Import `notice.css`.

`ActionsMenu` accepts `items` with `label`, `onClick`, and optional `id`, `icon`, `disabled`, and `variant="danger"`. Give the trigger a contextual `ariaLabel`, such as "Actions for Alex". The default trigger uses Lucide Ellipsis; an optional `trigger` element must forward its ref and native button props. Keyboard navigation, typeahead, disabled-item skipping, collision handling, dismissal, and focus restoration use Radix Dropdown Menu. `open`/`onOpenChange` or `defaultOpen`, `align`, `sideOffset`, `collisionPadding`, `portalContainer`, and `theme` allow customization. Import `actions-menu.css`. Menus inherit tokens from their trigger region and coordinate Escape with shared dialogs.

`Toast` and `ToastViewport` are presentation components with no notification store, provider, or timer. Pass `message`, `variant="success" | "error" | "info"`, optional `action`, `onDismiss`, and controlled `progress` (remaining fraction from 0 to 1). Import `toast.css`. Applications decide duration, queuing, persistence, and when to remove a notification. A timed host should pause expiry while hovered or while focus is within a toast. Pass native pointer/focus handlers to implement that policy. The message is announced separately from controls and the decorative progress ring. `announce` defaults to `"assertive"` for errors and `"polite"` otherwise; use `"off"` for non-announcing presentation. Use a meaningful `dismissLabel` when needed.

Keep the viewport mounted when empty. For dynamically added notifications, pass `announcements={{ polite, assertive }}` with keyed message-only children, and use `announce="off"` on each visual Toast. This creates persistent live regions before additions arrive, while omitting action labels, progress changes, and removals from announcements. The app adapters demonstrate this pattern. The visual stack scrolls when it fills its available height; override `--bnh-toast-bottom`, `--bnh-toast-z`, or native styles for app chrome offsets.

## Dialogs

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@cosborn2/ui/button';
import { Modal } from '@cosborn2/ui/modal';
import '@cosborn2/ui/button.css';
import '@cosborn2/ui/modal.css';

export function DetailsDialog({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Details"
      trigger={<Button type="button">Show details</Button>}
    >
      {children}
    </Modal>
  );
}
```

A Server Component can pass its rendered content as `children` to this client shell. Keep event handlers on the client side of the boundary.

Modal uses Radix Dialog for focus containment, screen-reader behavior, dismissal, and scroll locking. Give it a `title` or descriptive `ariaLabel`. `persistent` prevents dismissal while an operation is pending. `width` accepts a number in pixels or a CSS width; `zIndex`, `headerActions`, `footer`, `className`, and `bodyClassName` customize layout.

Portal content mounts after hydration, including when `open` starts true. The server and first browser render agree; dialog content is not promised in the initial server HTML. The trigger and surrounding server content render normally. No `ssr: false` is needed.

Dialogs inherit `--bnh-*` tokens from their rendering location even when portaled into the document body. Use `theme="light"` / `theme="dark"` for an explicit choice, or `portalContainer` for a custom mount location. Theme attribute/style changes on ancestors are observed while open.

`ConfirmDialog` adds cancel/confirm actions, optional loading state, and `typeToConfirm`. Its typed phrase resets when the dialog closes. Supply `children` for extra content such as a password field or verification notice, and `confirmDisabled` for application-owned prerequisites. Confirmation stays disabled while loading, while `confirmDisabled` is true, or until the typed phrase matches. The application owns validation and submission. Import `confirm-dialog.css`; it includes the button, input, and modal CSS it needs.

## Theme and overrides

Dark is the default. Set `data-bnh-theme="light"` on the document or a region to use light mode. `data-bnh-theme="dark"`, `.bnh-theme-light`, `.bnh-theme-dark`, and the legacy document `.light` class are supported.

```css
@import '@cosborn2/ui/theme.css';
@import '@cosborn2/ui/button.css';

:root {
  --bnh-font-sans: 'Your Sans', system-ui, sans-serif;
  --bnh-font-display: 'Your Display', Georgia, serif;
  --bnh-accent: #8b5cf6;
}
```

The apps own font loading, persistence, and system theme detection. The library downloads no fonts and installs no global reset. Colors, surfaces, radii, fonts, and header/page offsets are available as `--bnh-*` variables. The complete defaults are also exported as `@cosborn2/ui/tokens.json`.

CSS uses the layer order `theme, base, components, utilities`. Host resets belong in `base`; utility overrides belong in `utilities`; ordinary unlayered CSS also overrides package component styles. Existing Tailwind v4 projects can keep their own utility classes; no package source scanning is needed. Each component accepts appropriate `className`/`style` overrides, without loading a utility-class merger.

Settings layouts use `--bnh-page-offset` for a page-level banner and `--bnh-header-offset` for header placement. Applications supply those values; there is no impersonation or authentication dependency.

## Icons and dependencies

Plain Button imports no icon or dialog code. Icons are passed as children or rendered slots. Components with built-in icons import only those glyphs. React and React DOM are peer dependencies; Radix Dialog, Radix Dropdown Menu, and the pinned Lucide release are runtime dependencies reachable only from components that use them.

Lucide `0.577.0` is pinned to preserve server-compatible static icons. Current Lucide v1 uses client context internally. Upgrade only after the server-rendering and bundle fixtures pass; do not replace direct imports with an all-icons registry.

Installing npm packages downloads their dependency distributions. Tree shaking controls the JS/CSS shipped to the browser, not which files npm downloads. The package tests report those sizes separately.

## Development and verification

From the repository root:

```sh
bun install --frozen-lockfile
bun run lint
bun run build
bun run test
bunx playwright install chromium
bun run test:browser
```

The build emits separate ESM modules, declarations, and plain CSS. `dev` watches source and theme/style changes. The package fixtures install a packed tarball outside this repository and check Node SSR, production Next Server Components, browser hydration/accessibility, and compressed per-component JS/CSS budgets. Browser checks require Playwright Chromium and include the packed-package checks. Use `bun run test:package` when only the non-browser checks are needed.

Edit `tokens.json` for canonical theme changes, then run `bun run build` to regenerate the packaged theme. Applications own any compatibility aliases or infrastructure pages that consume these tokens. The library does not read application styles during its build.

## Release

Versions are chosen in reviewed PRs. With trusted publishing configured, version changes merged to `main` publish after validation; prereleases use `beta` and stable releases use `latest`. See the [publishing runbook](https://github.com/COsborn2/ui/blob/main/docs/publishing.md) for setup, release checks, and retries.

The public npm package includes only `dist`, this README, the MIT license, and package metadata. Consumers adopt new versions through their own dependency updates.

For development and review expectations, see [CONTRIBUTING.md](https://github.com/COsborn2/ui/blob/main/CONTRIBUTING.md). Report vulnerabilities through the private channel in [SECURITY.md](https://github.com/COsborn2/ui/blob/main/SECURITY.md).
