# Testing components

The suite tests the library's public React behavior using [Storybook's standard Vitest integration](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon). It has two layers, both run by Vitest:

- **Unit tests:** React Testing Library and `user-event` in jsdom cover controlled/uncontrolled state, native form behavior, callbacks, disabled/loading states, accessible names and descriptions, and event/ref composition. Release-decision tests use Node.
- **Storybook tests:** the official Vitest addon runs each story in Chromium, executes its `play` interactions, and runs the accessibility addon (axe). Stories also serve as browsable examples with controls and a light/dark theme toolbar. Keyboard focus, portals, dialog/menu composition, and real browser interactions belong here.

Playwright supplies the browser through Vitest's standard provider. There are no separate Playwright specs or custom browser/SSR consumer servers. Production Next integration, SSR/hydration, JavaScript-disabled routes, and bundle-size budgets are outside this suite.

## Commands

Use Node 26 and the repository's pinned Bun version.

```sh
bun install --frozen-lockfile
bunx playwright install chromium
bun run storybook
```

```sh
bun run test                       # all unit, interaction, and accessibility tests
bun run test:unit                  # jsdom/Node tests only
bun run test:stories               # Storybook tests only
bun run test:unit tests/dialog-behavior.test.tsx
bun run test:stories stories/modal.stories.tsx
bun run test:stories --browser.headless=false
bun run test --coverage            # text, HTML, and LCOV reports under coverage/
```

`bun run build-storybook` produces a static component catalog under `storybook-static/`. `bun run check:package` checks the already-built npm file list and export destinations; it performs no SSR or size measurements. CI and the publish workflow run lint/types, build, the full test suite, the Storybook build, and this package-content check.

## Test conventions

- Render the public component and interact as its consumer would. Prefer role/name/label queries and `userEvent`; avoid snapshots, private React element inspection, hook internals, and incidental class names.
- Test one contract or regression per case. Cover a meaningful failure mode rather than mirroring the implementation or adding cases to inflate coverage.
- For controlled components, assert callback arguments and rerender with new props. Do not imply the component owns state that belongs to the application.
- Use event dispatch or layout-effect fixtures only when a regression specifically depends on same-commit timing; explain why ordinary awaited interactions cannot reproduce it.
- Use `findBy*` or `waitFor` for asynchronous DOM changes. Avoid arbitrary sleeps and assertions that race opening/closing animations.
- Every mounted component is cleaned up between unit tests. jsdom shims only supply missing APIs; they do not claim to test layout or positioning.
- Keep open-state dialog/menu examples as well as dismissal interactions so accessibility scans inspect portaled content. Accessibility scans normally include the document body, not only the story's root. The two persistently open menu stories scope axe to the active menu: axe does not recognize Radix's modal menu focus trap and otherwise reports the hidden background trigger. Those stories separately verify Tab, Shift+Tab, and attempted background focus remain inside the menu; closed-state stories still scan the whole document. No axe rules are disabled.
- Keep accessibility failures actionable. Do not disable a rule globally to hide a component issue. Automated scans supplement keyboard/manual review; they do not prove complete accessibility.
- Keep stories and tests outside `src` so the library build and npm package contain only production code/styles/types.

The source CSS and canonical tokens are unchanged by Storybook decorators. The preview imports the built styles, applies the selected theme, and provides a small page shell. Refresh generated CSS with `bun run build:styles` after changing styles or tokens; `storybook`, `test`, and `test:stories` do this on startup.

Browser failure screenshots go to `test-results/` and are uploaded as CI artifacts for seven days. The suite does not currently compare screenshot baselines. Add visual regression testing only with an intentional baseline/review workflow rather than treating screenshots as assertions.
