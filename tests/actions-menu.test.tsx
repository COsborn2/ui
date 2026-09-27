import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ActionsMenu } from "../src/actions-menu.js";
import { Button } from "../src/button.js";

const items = [{ label: "Delete", variant: "danger" as const, onClick() {} }];

describe("ActionsMenu server rendering", () => {
  test("renders a named non-submit menu trigger without browser globals", () => {
    const html = renderToString(<ActionsMenu items={items} />);
    expect(html).toContain('aria-label="More actions"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="menu"');
  });

  test("defers initially open portal content until hydration", () => {
    const html = renderToString(<ActionsMenu items={items} defaultOpen />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("Delete");
  });

  test("disables empty and unavailable triggers", () => {
    expect(renderToString(<ActionsMenu items={[]} />)).toContain('disabled=""');
    expect(renderToString(<ActionsMenu items={items} disabled open />)).toContain('aria-expanded="false"');
  });

  test("keeps a custom trigger's accessible text and styles", () => {
    const html = renderToString(<ActionsMenu items={items} trigger={<Button>Account actions</Button>} />);
    expect(html).toContain("Account actions");
    expect(html).toContain("bnh-button");
    expect(html).not.toContain('aria-label="More actions"');
    expect(html).not.toContain("bnh-actions-menu-trigger");
  });
});
