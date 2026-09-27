import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { ColorPicker } from "../src/color-picker";
import { ThemeToggle } from "../src/theme-toggle";

describe("controlled preference controls", () => {
  test("renders the supplied theme during SSR without reading browser storage", () => {
    const html = renderToString(<form><ThemeToggle value="light" onChange={() => {}} /></form>);
    expect(html).toContain('role="group" aria-label="Theme"');
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true" aria-label="Light theme"');
  });

  test("accepts a caller palette, labels, disabled choices, and no-color selection", () => {
    const html = renderToString(<ColorPicker value={null} onChange={() => {}} noneLabel="No accent"
      colors={[{ value: "#123456", label: "Ocean" }, { value: "#654321", label: "Earth", disabled: true }]} />);
    expect(html).toContain('aria-label="No accent" aria-pressed="true"');
    expect(html).toContain('aria-label="Ocean"');
    expect(html).toContain('disabled="" title="Earth"');
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html).not.toContain("Green");
  });

  test("can remove the empty option and disable both groups", () => {
    const palette = renderToString(<ColorPicker value="#123456" onChange={() => {}} allowNone={false}
      disabled colors={[{ value: "#123456", label: "Ocean" }]} />);
    expect(palette).not.toContain("None");
    expect(palette.match(/disabled=""/g)).toHaveLength(1);
    const theme = renderToString(<ThemeToggle value="system" onChange={() => {}} disabled labels={{ system: "Automatic" }} />);
    expect(theme.match(/disabled=""/g)).toHaveLength(3);
    expect(theme).toContain('aria-label="Automatic"');
  });
});
