import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsCard, SettingsCardHeader, SettingsLayout, SettingsNavigation, SettingsPageHeader, SettingsRow, SettingsSection } from "../src/settings.js";
import { SettingsRail } from "../src/settings-rail.js";
import { Input } from "../src/input.js";

describe("settings composition", () => {
  test("provides page landmarks, heading hierarchy, navigation links and labeled fields", async () => {
    const user = userEvent.setup();
    render(<SettingsLayout header={<header>Example app</header>} navigation={<SettingsNavigation active="profile" sections={[{ group: "Account", items: [
      { id: "profile", label: "Profile", href: "/settings/profile" },
      { id: "security", label: "Security", href: "/settings/security", badge: 0 },
    ] }]} />}>
      <SettingsPageHeader eyebrow="Account" title="Settings" description="Your preferences." />
      <SettingsSection title="Personal details">
        <SettingsCard aria-label="Profile"><SettingsCardHeader title="Profile" subtitle="Edit your profile." />
          <SettingsRow label={<label htmlFor="name">Name</label>} hint="Your display name" first><Input id="name" defaultValue="Ada" /></SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </SettingsLayout>);
    const nav = screen.getByRole("navigation", { name: "Settings" });
    expect(within(nav).getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: /Security\s*0/ })).toHaveAttribute("href", "/settings/security");
    expect(within(nav).getByRole("link", { name: /Security\s*0/ })).not.toHaveAttribute("aria-current");
    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { level: 2, name: "Personal details" })).toBeInTheDocument();
    expect(within(main).getByRole("heading", { level: 3, name: "Profile" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Grace");
    expect(screen.getByLabelText("Name")).toHaveValue("Grace");
  });

  test("controlled rail switches the displayed section without submitting the surrounding form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event) => event.preventDefault());
    function Settings() {
      const [active, setActive] = useState("profile");
      return <form onSubmit={submit}><SettingsRail active={active} onChange={setActive} sections={[{ group: "Account", items: [
        { id: "profile", label: "Profile", controls: "profile-panel" }, { id: "security", label: "Security", controls: "security-panel" },
      ] }]} /><section id="profile-panel" aria-label="Profile details" hidden={active !== "profile"}>Display name</section>
        <section id="security-panel" aria-label="Security details" hidden={active !== "security"}>Account password</section></form>;
    }
    render(<Settings />);
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
    const security = screen.getByRole("button", { name: "Security" });
    expect(security).toHaveAttribute("aria-current", "true");
    expect(security).toHaveAttribute("aria-controls", "security-panel");
    expect(screen.getByRole("region", { name: "Security details" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Profile details" })).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  test("header action slots remain accessible and caller section styles take precedence", async () => {
    const user = userEvent.setup();
    const requestDelete = vi.fn();
    render(<SettingsSection aria-label="Account actions" title="Delete account" accent="rose" index={2} style={{ animationDelay: "0ms" }}
      headerAction={<button onClick={requestDelete}>Delete</button>}><p>Deletion is permanent.</p></SettingsSection>);
    expect(screen.getByRole("region", { name: "Account actions" })).toHaveStyle({ animationDelay: "0ms" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(requestDelete).toHaveBeenCalledOnce();
  });
});
