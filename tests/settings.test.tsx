import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsLayout,
  SettingsNavigation,
  SettingsPageHeader,
  SettingsRow,
  SettingsSection,
} from "../src/settings.js";
import { SettingsRail } from "../src/settings-rail.js";

describe("settings server rendering", () => {
  test("renders a complete page and link navigation without browser globals or callbacks", () => {
    const html = renderToStaticMarkup(
      <SettingsLayout
        header={<header>Example app</header>}
        navigation={
          <SettingsNavigation
            active="profile"
            sections={[{ group: "Account", items: [
              { id: "profile", label: "Profile", href: "/settings/profile" },
              { id: "security", label: "Security", href: "/settings/security", badge: 0 },
            ] }]}
          />
        }
      >
        <SettingsPageHeader eyebrow="Account" title="Settings" description="Your preferences." />
        <SettingsCard>
          <SettingsCardHeader title="Profile" subtitle="Edit your profile." />
          <SettingsRow label={<label htmlFor="name">Name</label>} hint="Your display name" first>
            <input id="name" defaultValue="Ada" />
          </SettingsRow>
        </SettingsCard>
      </SettingsLayout>,
    );
    expect(html).toContain('<nav aria-label="Settings"');
    expect(html).toContain('href="/settings/profile" aria-current="page"');
    expect(html).toContain('href="/settings/security" class=');
    expect(html.match(/aria-current=/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="bnh-settings-title">Settings</h1>');
    expect(html).toContain('<main class="bnh-settings-main">');
    expect(html).toContain('<label for="name">Name</label>');
    expect(html).toContain('class="bnh-settings-rail-badge">0</span>');
    expect(html).not.toContain("rb-");
    expect(html).not.toContain("<script");
  });

  test("controlled rail announces the current section and never submits an enclosing form", () => {
    const html = renderToStaticMarkup(
      <SettingsRail
        active="security"
        onChange={() => { throw new Error("Rendering must not change selection"); }}
        sections={[{ group: "Account", items: [
          { id: "profile", label: "Profile", controls: "profile-panel" },
          { id: "security", label: "Security", controls: "security-panel", icon: <svg /> },
        ] }]}
      />,
    );
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="true" aria-controls="security-panel"');
    expect(html).toContain('class="bnh-settings-rail-icon" aria-hidden="true"');
  });

  test("keeps section styling and caller overrides declarative during SSR", () => {
    const html = renderToStaticMarkup(
      <SettingsSection title="Delete account" accent="rose" index={2} style={{ animationDelay: "0ms" }}>
        <p>Deletion is permanent.</p>
      </SettingsSection>,
    );
    expect(html).toContain("bnh-settings-section--rose");
    expect(html).toContain('style="animation-delay:0ms"');
    expect(html).toContain('<h2 class="bnh-settings-section-title">Delete account</h2>');
  });
});
