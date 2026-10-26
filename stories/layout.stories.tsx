import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { HeaderShell } from "../src/header-shell.js";
import { Surface } from "../src/surface.js";
import { GlassPopoverSurface } from "../src/glass-popover-surface.js";
import { Skeleton } from "../src/skeleton.js";
import { Pill } from "../src/pill.js";
import { Button } from "../src/button.js";
import { Input } from "../src/input.js";
import { Switch } from "../src/switch.js";
import { ThemeToggle, type ThemePreference } from "../src/theme-toggle.js";
import { DataTable, type DataTableColumn } from "../src/data-table.js";
import { Pagination } from "../src/pagination.js";
import { SettingsCard, SettingsCardHeader, SettingsLayout, SettingsNavigation, SettingsPageHeader, SettingsRow, SettingsSection } from "../src/settings.js";
import { SettingsRail } from "../src/settings-rail.js";

type LayoutArgs = { onAction: () => void; onNavigate: (section: string) => void; onPageChange: (page: number) => void };
const meta = {
  title: "Components/Layout and data",
  args: { onAction: fn(), onNavigate: fn(), onPageChange: fn() },
  parameters: { layout: "padded" },
} satisfies Meta<LayoutArgs>;
export default meta;
type Story = StoryObj<LayoutArgs>;
const stack = { display: "grid", gap: 24 } as const;

export const AppHeader: Story = {
  render: ({ onAction }) => <HeaderShell as="header" aria-label="Application header" width="full" style={{ position: "relative", top: 0 }}
    left={<a href="#home" style={{ color: "var(--bnh-text)", fontWeight: 700 }}>Example app</a>}
    right={<div style={{ display: "flex", gap: 12, alignItems: "center" }}><Pill tint="var(--bnh-green)">Online</Pill><Button variant="secondary" size="sm" onClick={onAction}>Account</Button></div>} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("link", { name: "Example app" })).toHaveAttribute("href", "#home");
    await userEvent.click(canvas.getByRole("button", { name: "Account" }));
    await expect(args.onAction).toHaveBeenCalled();
  },
};

export const Surfaces: Story = {
  render: ({ onAction }) => <section aria-label="Surface examples" style={{ ...stack, maxWidth: 700 }}>
    <h2>Content surfaces</h2>
    {(["raised", "glass", "frosted"] as const).map((variant) => <Surface key={variant} variant={variant} style={{ padding: 24 }}>
      <h3>{variant.charAt(0).toUpperCase() + variant.slice(1)}</h3><p>Use shared theme tokens to compose your own content.</p>
      <Pill tint="var(--bnh-accent)">In progress</Pill>
    </Surface>)}
    <GlassPopoverSurface style={{ padding: 20 }}><p>Popover surface with application content.</p></GlassPopoverSurface>
    <GlassPopoverSurface as="button" type="button" onClick={onAction} style={{ padding: 20 }}>Open details</GlassPopoverSurface>
  </section>,
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open details" }));
    await expect(args.onAction).toHaveBeenCalled();
  },
};
export const LightSurfaces: Story = { ...Surfaces, globals: { theme: "light" } };

export const LoadingContent: Story = {
  render: () => <Surface role="status" aria-label="Loading project details" style={{ ...stack, padding: 24, maxWidth: 500 }}>
    <Skeleton style={{ width: "50%", height: 24 }} />
    <Skeleton style={{ width: "100%", height: 16 }} />
    <Skeleton style={{ width: "80%", height: 16 }} />
  </Surface>,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status", { name: "Loading project details" })).toBeInTheDocument();
  },
};

type Person = { id: string; name: string; role: string };
const people: Person[] = [
  { id: "ada", name: "Ada Lovelace", role: "Admin" },
  { id: "grace", name: "Grace Hopper", role: "Editor" },
  { id: "alan", name: "Alan Turing", role: "Editor" },
  { id: "katherine", name: "Katherine Johnson", role: "Viewer" },
  { id: "margaret", name: "Margaret Hamilton", role: "Admin" },
];
const columns: DataTableColumn<Person>[] = [
  { key: "name", header: "Name", render: (person) => person.name },
  { key: "role", header: "Role", render: (person) => <Pill>{person.role}</Pill> },
];
function PeopleTable({ onPageChange, onNavigate }: LayoutArgs) {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const changePage = (value: number) => { setPage(value); onPageChange(value); };
  return <section aria-label="Team directory" style={stack}>
    <DataTable caption="Team members" columns={columns} data={people.slice(page * 2, page * 2 + 2)} getRowKey={(person) => person.id}
      onRowClick={(person) => { setSelected(person.name); onNavigate(person.id); }} />
    <Pagination page={page} total={people.length} pageSize={2} itemLabel="person" itemLabelPlural="people" onPageChange={changePage} />
    <p role="status">{selected ? `Selected ${selected}` : "Select a team member to view details."}</p>
  </section>;
}
export const TableAndPagination: Story = {
  render: (args) => <PeopleTable {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const ada = canvas.getByRole("row", { name: /Ada Lovelace/ });
    ada.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("Selected Ada Lovelace");
    await expect(args.onNavigate).toHaveBeenCalledWith("ada");
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByText("Showing 3-4 of 5 people")).toBeInTheDocument();
    await expect(args.onPageChange).toHaveBeenCalledWith(1);
    await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    await expect(canvas.getByRole("button", { name: "Next" })).toBeDisabled();
    await expect(canvas.getByRole("row", { name: /Margaret Hamilton/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Previous" }));
    await expect(canvas.getByRole("row", { name: /Alan Turing/ })).toBeInTheDocument();
  },
};
export const LightTable: Story = { ...TableAndPagination, globals: { theme: "light" } };

export const TableStates: Story = {
  render: ({ onAction }) => <section aria-label="Table states" style={stack}>
    <DataTable caption="Loading team members" columns={columns} data={[]} loading loadingRows={3} />
    <DataTable caption="Filtered team members" columns={columns} data={[]}
      emptyMessage={<><p>No matching people.</p><Button variant="secondary" size="sm" onClick={onAction}>Clear filters</Button></>} />
    <Pagination page={0} total={0} itemLabel="person" itemLabelPlural="people" />
    <DataTable caption="Team member links" data={people.slice(0, 2)} columns={[
      { key: "name", header: "Name", render: (person) => <a href={`#${person.id}`} style={{ color: "var(--bnh-text)" }}>{person.name}</a> }, columns[1]!,
    ]} />
    <Pagination page={1} total={45} itemLabel="person" itemLabelPlural="people" getPageHref={(page) => `#page-${page + 1}`} aria-label="Linked pagination" />
  </section>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("table", { name: "Loading team members" })).toHaveAttribute("aria-busy", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Clear filters" }));
    await expect(args.onAction).toHaveBeenCalled();
    const navigation = within(canvas.getByRole("navigation", { name: "Linked pagination" }));
    await expect(navigation.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "#page-1");
    await expect(navigation.getByRole("link", { name: "Next" })).toHaveAttribute("href", "#page-3");
  },
};

const sections = [{ group: "Account", items: [
  { id: "profile", label: "Profile", controls: "profile-panel" },
  { id: "appearance", label: "Appearance", controls: "appearance-panel" },
  { id: "security", label: "Security", controls: "security-panel" },
] }];
function SettingsExample({ onAction, onNavigate }: LayoutArgs) {
  const [active, setActive] = useState("profile");
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [name, setName] = useState("Ada");
  const [saved, setSaved] = useState("");
  return <SettingsLayout
    header={<HeaderShell as="header" aria-label="Application" style={{ position: "relative", top: 0, marginBottom: 24 }} left={<a href="#home" style={{ color: "var(--bnh-text)" }}>Example app</a>} right={<Pill>Personal account</Pill>} />}
    navigation={<SettingsRail active={active} sections={sections} onChange={(value) => { setActive(value); onNavigate(value); }} />}>
    <SettingsPageHeader title="Settings" eyebrow="Your account" description="Manage your profile and preferences." />
    <SettingsSection hidden={active !== "profile"} id="profile-panel" title="Personal details">
      <SettingsCard><SettingsCardHeader title="Profile" subtitle="Choose how your name appears to your team." />
        <form aria-label="Profile settings" onSubmit={(event) => { event.preventDefault(); setSaved(`Saved ${name}`); onAction(); }}>
          <SettingsRow first label={<label htmlFor="profile-name">Display name</label>} hint="Visible to your teammates.">
            <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
          </SettingsRow>
          <SettingsRow label="Profile changes"><Button size="sm">Save profile</Button></SettingsRow>
        </form>
      </SettingsCard>
    </SettingsSection>
    <SettingsSection hidden={active !== "appearance"} id="appearance-panel" title="Appearance">
      <SettingsCard><SettingsCardHeader title="Display preferences" subtitle="Controls emit preferences; your application applies them." />
        <SettingsRow first label="Theme" hint="Choose a theme or follow your device."><ThemeToggle value={theme} onChange={setTheme} /></SettingsRow>
        <SettingsRow label="Notifications"><Switch label="Weekly email summary" description="Receive a summary every Monday." defaultChecked /></SettingsRow>
      </SettingsCard>
    </SettingsSection>
    <SettingsSection hidden={active !== "security"} id="security-panel" title="Account security" accent="rose">
      <SettingsCard danger><SettingsCardHeader danger title="Delete account" subtitle="Your application owns confirmation and authorization." />
        <SettingsRow first label="Account deletion" hint="This example does not delete anything."><Button variant="danger" type="button" onClick={onAction}>Request deletion</Button></SettingsRow>
      </SettingsCard>
    </SettingsSection>
    <p role="status">{saved}</p>
  </SettingsLayout>;
}
export const SettingsPage: Story = {
  parameters: { layout: "fullscreen", hasMainLandmark: true },
  render: (args) => <SettingsExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByRole("textbox", { name: "Display name" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Display name" }), "Grace");
    await userEvent.click(canvas.getByRole("button", { name: "Save profile" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Saved Grace");
    await expect(args.onAction).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Appearance" }));
    await expect(args.onNavigate).toHaveBeenCalledWith("appearance");
    await userEvent.click(canvas.getByRole("button", { name: "Light theme" }));
    await expect(canvas.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(canvas.getByRole("button", { name: "Security" }));
    await expect(canvas.getByRole("heading", { level: 2, name: "Account security" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Profile" }));
    await expect(canvas.getByRole("textbox", { name: "Display name" })).toHaveValue("Grace");
  },
};
export const LightSettings: Story = { ...SettingsPage, globals: { theme: "light" } };

export const SettingsLinks: Story = {
  parameters: { layout: "fullscreen", hasMainLandmark: true },
  render: () => <SettingsLayout navigation={<SettingsNavigation active="profile" sections={[{ group: "Account", items: [
    { id: "profile", label: "Profile", href: "#profile" }, { id: "security", label: "Security", href: "#security", badge: 2 },
  ] }]} />}>
    <SettingsPageHeader title="Settings" description="Use native links when each section has its own route." />
    <SettingsSection title="Profile"><SettingsCard><SettingsCardHeader title="Your profile" /><SettingsRow first label="Name">Ada Lovelace</SettingsRow></SettingsCard></SettingsSection>
  </SettingsLayout>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const navigation = within(canvas.getByRole("navigation", { name: "Settings" }));
    await expect(navigation.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link", { name: /Security/ })).toHaveAttribute("href", "#security");
  },
};
