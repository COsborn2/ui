import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderShell } from "../src/header-shell.js";

describe("HeaderShell native composition", () => {
  test("forwards landmark naming and native attributes while preserving its slots", () => {
    const html = renderToStaticMarkup(
      <HeaderShell
        as="header"
        aria-label="Account navigation"
        data-tour="account-header"
        title="Your account"
        tabIndex={-1}
        left={<a href="/">Home</a>}
        right={<button type="button">Account</button>}
      />,
    );
    expect(html).toStartWith("<header");
    expect(html).toContain('aria-label="Account navigation"');
    expect(html).toContain('data-tour="account-header"');
    expect(html).toContain('title="Your account"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('<a href="/">Home</a>');
    expect(html).toContain('<button type="button">Account</button>');
    expect(html).not.toContain('left="');
  });

  test("keeps the default div and caller styles when native attributes are supplied", () => {
    const html = renderToStaticMarkup(
      <HeaderShell
        role="group"
        aria-label="Page controls"
        className="page-chrome"
        width="full"
        top={32}
        style={{ position: "relative", top: 0 }}
        left="Page controls"
      />,
    );
    expect(html).toStartWith("<div");
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Page controls"');
    expect(html).toContain('class="bnh-header-shell page-chrome"');
    expect(html).toContain("position:relative");
    expect(html).toContain("top:0");
    expect(html).toContain("width:min(calc(100vw - 48px), calc(100vw - 28px))");
  });
});
