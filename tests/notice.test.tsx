import { describe, expect, test } from "bun:test";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Notice } from "../src/notice.js";

describe("Notice server rendering", () => {
  test("renders static warnings without forcing an announcement or interaction", () => {
    const html = renderToStaticMarkup(<Notice tone="danger" heading="Account restricted">Contact your administrator.</Notice>);
    expect(html).toContain("Account restricted");
    expect(html).toContain("Contact your administrator.");
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-live=");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<svg");
  });

  test("lets callers explicitly announce changing status or errors", () => {
    const status = renderToStaticMarkup(<Notice tone="success" role="status" aria-atomic="true">Preferences saved.</Notice>);
    expect(status).toContain('role="status"');
    expect(status).toContain('aria-atomic="true"');
    expect(status).toContain("Preferences saved.");
    const error = renderToStaticMarkup(<Notice tone="danger" role="alert">Could not save.</Notice>);
    expect(error).toContain('role="alert"');
    expect(error).not.toContain("aria-live=");
  });

  test("accepts rich content and separate actions without hiding the action from assistive technology", () => {
    const html = renderToStaticMarkup(
      <Notice
        heading={<strong>Verify your email</strong>}
        icon={<svg><path d="M1 1h2" /></svg>}
        actions={<a href="/verify">Review details</a>}
      >
        <p>We sent a link to <strong>alex@example.com</strong>.</p>
        <p>It expires in ten minutes.</p>
      </Notice>,
    );
    expect(html).toContain('<span class="bnh-notice-icon" aria-hidden="true"><svg>');
    expect(html).toContain('<div class="bnh-notice-message"><p>');
    expect(html).toContain('<div class="bnh-notice-actions"><a href="/verify">Review details</a></div>');
    expect(html.match(/aria-hidden=/g)).toHaveLength(1);
  });

  test("preserves native attributes, refs and caller overrides", () => {
    const ref = createRef<HTMLDivElement>();
    const tree = Notice({
      ref,
      id: "notice",
      title: "More information",
      role: "note",
      "aria-label": "Account information",
      className: "custom-notice",
      style: { padding: 24 },
      children: "Read <carefully>.",
    });
    expect(tree.props.ref).toBe(ref);
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('id="notice"');
    expect(html).toContain('title="More information"');
    expect(html).toContain('aria-label="Account information"');
    expect(html).toContain('class="bnh-notice bnh-notice--neutral custom-notice"');
    expect(html).toContain('style="padding:24px"');
    expect(html).toContain("Read &lt;carefully&gt;.");
  });
});
