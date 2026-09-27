import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { Button } from "../src/button.js";
import { Input } from "../src/input.js";
import { Select } from "../src/select.js";
import { IconButton } from "../src/icon-button.js";
import { Pill } from "../src/pill.js";
import { ExpandablePill } from "../src/expandable-pill.js";
import { SegmentedControl } from "../src/segmented-control.js";
import { Switch } from "../src/switch.js";
import { HeaderShell } from "../src/header-shell.js";
import { assertIsolatedImports } from "../scripts/verify-package.js";

describe("native form behavior", () => {
  test("Button preserves native submit semantics and explicit overrides", () => {
    const submit = renderToString(<Button name="intent" value="save">Save</Button>);
    expect(submit).not.toContain('type="button"');
    expect(submit).toContain('name="intent"');
    expect(submit).toContain('value="save"');
    expect(renderToString(<Button type="button">Cancel</Button>)).toContain('type="button"');
    expect(renderToString(<IconButton aria-label="Delete" />)).toContain('type="button"');
  });

  test("repeated labels receive unique, associated ids in server HTML", () => {
    const html = renderToString(<><Input label="Name" /><Input label="Name" /><Select label="Name"><option>A</option></Select></>);
    const ids = [...html.matchAll(/<(?:input|select)[^>]* id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(html).toContain(`for="${id}"`);
  });

  test("errors augment caller descriptions and preserve explicit IDs", () => {
    const html = renderToString(<Input id="email" label="Email" error="Enter a valid email" aria-describedby="email-help" />);
    expect(html).toContain('for="email"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="email-help email-error"');
    expect(html).toContain('id="email-error"');
    const select = renderToString(<Select id="plan" label="Plan" error="Choose one"><option value="">Select</option></Select>);
    expect(select).toContain('aria-describedby="plan-error"');
    expect(select).toContain('id="plan-error"');
  });

  test("compact selects retain native selection rather than setting the HTML size attribute", () => {
    const html = renderToString(<Select size="sm" label="Team" name="team" defaultValue="other"><option value="all">All</option><option value="other">Other</option></Select>);
    expect(html).toContain("bnh-select--sm");
    expect(html).toContain('name="team"');
    expect(html).toContain('value="other" selected=""');
    expect(html).not.toContain('size="sm"');
  });

  test("Switch is a labeled native checkbox with form data and description", () => {
    const html = renderToString(<Switch id="notifications" name="notifications" value="enabled" defaultChecked label="Notifications" description="Email me updates" />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('role="switch"');
    expect(html).toContain('name="notifications"');
    expect(html).toContain('checked=""');
    expect(html).toContain('for="notifications"');
    expect(html).toContain('aria-labelledby="notifications-label"');
    expect(html).toContain('aria-describedby="notifications-description"');
    expect(html).toContain('id="notifications-description"');
  });
});

describe("composable static and interactive surfaces", () => {
  test("static Pill renders without disclosure controls", () => {
    const html = renderToString(<Pill>Ready</Pill>);
    expect(html).toContain("Ready");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("aria-expanded");
  });

  test("closed disclosure associates and removes its panel from interaction", () => {
    const html = renderToString(<ExpandablePill panel={<button>Panel action</button>}>Details</ExpandablePill>);
    const panelId = html.match(/aria-controls="([^"]+)"/)?.[1];
    expect(panelId).toBeDefined();
    expect(html).toContain(`id="${panelId}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
  });

  test("controlled disclosure state wins over its initial default", () => {
    const html = renderToString(<ExpandablePill open defaultOpen={false} panel={<span>Details</span>}>Open</ExpandablePill>);
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('inert=""');
    expect(html).toContain('aria-hidden="false"');
  });

  test("segmented choices expose selection, name and disabled state", () => {
    const html = renderToString(<SegmentedControl aria-label="View" items={[{ id: "all", label: "All" }, { id: "mine", label: "Mine", disabled: true }]} value="all" onChange={() => {}} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="View"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('disabled=""');
  });

  test("header is a server-rendered landmark with app-provided slots", () => {
    const html = renderToString(<HeaderShell as="header" left={<a href="/">Brand</a>} right={<Button>Save</Button>} />);
    expect(html.startsWith("<header")).toBe(true);
    expect(html).toContain('href="/"');
    expect(html).toContain("Save");
    expect(html).toContain(">Brand</a>");
    expect(html).not.toContain("--rb-");
  });
});

describe("published dependency isolation", () => {
  const manifest = {
    dependencies: { "lucide-react": "0.577.0" },
    peerDependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
  };

  test("accepts declared packages, peer subpaths and relative distribution imports", () => {
    expect(() => assertIsolatedImports(`
      import { jsx } from "react/jsx-runtime";
      export { Button } from "./button.js";
      type Node = import("react").ReactNode;
      const icons = import("lucide-react");
      const portal = require("react-dom");
      // import { unrelated } from "@private/app";
    `, "dist/example.js", manifest)).not.toThrow();
  });

  test("rejects undeclared application aliases and packages across import forms", () => {
    for (const source of [
      'import { store } from "@/store";',
      'export { session } from "@private/app";',
      'const session = import("@private/app/session");',
      'const store = require("undeclared-store");',
      'type Session = import("@private/app").Session;',
    ]) expect(() => assertIsolatedImports(source, "dist/example.js", manifest)).toThrow("Undeclared dependency");
  });

  test("rejects application runtimes even when someone declares them", () => {
    for (const name of ["next", "zustand", "@fortawesome/free-solid-svg-icons"]) {
      expect(() => assertIsolatedImports(`import "${name}";`, "dist/example.js", {
        dependencies: { [name]: "1.0.0" },
      })).toThrow("Application runtime dependency");
    }
  });

  test("rejects private workspace dependencies and relative escapes from dist", () => {
    for (const version of ["workspace:*", "file:../private", "link:../private", "npm:private-app@1.0.0"]) {
      expect(() => assertIsolatedImports('import "private-app";', "dist/example.js", {
        dependencies: { "private-app": version },
      })).toThrow("Nonportable dependency");
    }
    expect(() => assertIsolatedImports('export { session } from "../../private/session.js";', "dist/example.js", manifest))
      .toThrow("Import escapes the published distribution");
  });
});
