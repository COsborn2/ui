import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button, buttonClassName, type ButtonProps } from "../src/button.js";
import { Input } from "../src/input.js";
import { Select } from "../src/select.js";
import { Switch } from "../src/switch.js";
import { IconButton } from "../src/icon-button.js";
import { GhostTextButton } from "../src/ghost-text-button.js";
import { Pill } from "../src/pill.js";
import { ExpandablePill } from "../src/expandable-pill.js";
import { SegmentedControl } from "../src/segmented-control.js";
import { ThemeToggle, type ThemePreference } from "../src/theme-toggle.js";
import { ColorPicker } from "../src/color-picker.js";
import { Surface } from "../src/surface.js";

type ControlArgs = { disabled: boolean; variant: ButtonProps["variant"]; size: ButtonProps["size"]; onAction: () => void };
const meta = {
  title: "Components/Controls",
  args: { disabled: false, variant: "primary", size: "md", onAction: fn() },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
  parameters: { layout: "padded" },
} satisfies Meta<ControlArgs>;
export default meta;
type Story = StoryObj<ControlArgs>;
const stack = { display: "grid", gap: 20, maxWidth: 560 } as const;
const row = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" } as const;

export const Buttons: Story = {
  render: ({ disabled, variant, size, onAction }) => <section aria-label="Button examples" style={stack}>
    <div style={row}><Button variant={variant} size={size} disabled={disabled} onClick={onAction}>Save changes</Button>
      <Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Delete</Button></div>
    <div style={row}><Button size="sm">Small</Button><Button size="lg">Large</Button><Button disabled>Unavailable</Button>
      <IconButton aria-label="Add item" onClick={onAction}><span aria-hidden="true">+</span></IconButton>
      <IconButton tone="danger" aria-label="Remove item" disabled><span aria-hidden="true">×</span></IconButton>
      <GhostTextButton onClick={onAction}>More information</GhostTextButton></div>
    <a className={buttonClassName({ variant: "secondary" })} href="#button-link">A styled native link</a>
  </section>,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    if (!args.disabled) {
      await userEvent.click(canvas.getByRole("button", { name: "Save changes" }));
      await expect(args.onAction).toHaveBeenCalled();
    }
    await expect(canvas.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    await expect(canvas.getByRole("link")).toHaveAttribute("href", "#button-link");
  },
};

function ProfileForm({ disabled, onAction }: ControlArgs) {
  const [saved, setSaved] = useState("");
  return <form aria-label="Profile" style={stack} onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaved(`Saved ${data.get("name")} in ${data.get("team")}. Emails ${data.has("emails") ? "on" : "off"}.`);
    onAction();
  }}>
    <Input label="Display name" name="name" placeholder="Your name" required disabled={disabled} />
    <Select label="Team" name="team" defaultValue="Design" disabled={disabled}><option>Design</option><option>Engineering</option></Select>
    <Switch label="Email updates" name="emails" description="Receive a weekly summary." disabled={disabled} />
    <Button disabled={disabled}>Save profile</Button>
    <p role="status">{saved}</p>
  </form>;
}
export const NativeForm: Story = {
  render: (args) => <ProfileForm {...args} />,
  play: async ({ canvasElement, args }) => {
    if (args.disabled) return;
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByRole("textbox", { name: "Display name" }), "Ada");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Team" }), "Engineering");
    await userEvent.click(canvas.getByRole("switch", { name: "Email updates" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save profile" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Saved Ada in Engineering. Emails on.");
    await expect(args.onAction).toHaveBeenCalled();
  },
};

export const FieldStates: Story = {
  render: () => <section aria-label="Field states" style={stack}>
    <p id="email-format">Use your work email.</p>
    <Input id="work-email" label="Email" defaultValue="ada" aria-describedby="email-format" error="Enter a valid email address." />
    <Select label="Required plan" defaultValue="" error="Choose a plan."><option value="">Choose a plan</option><option>Team</option></Select>
    <Input label="Read-only reference" readOnly value="PROJECT-42" />
    <Input label="Disabled input" disabled defaultValue="Unavailable" />
    <Select label="Compact select" size="sm" defaultValue="Weekly"><option>Weekly</option><option>Monthly</option></Select>
    <Switch label="Managed preference" description="Set by your administrator." disabled defaultChecked />
  </section>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription("Use your work email. Enter a valid email address.");
    await expect(canvas.getByRole("textbox", { name: "Email" })).toBeInvalid();
    await expect(canvas.getByRole("switch", { name: "Managed preference" })).toBeDisabled();
  },
};

function ViewSelection() {
  const [view, setView] = useState("all");
  return <section aria-label="View selection" style={stack}><SegmentedControl aria-label="View" value={view} onChange={setView} items={[
    { id: "all", label: "All", count: 12 }, { id: "mine", label: "Mine", count: 4, accent: "var(--bnh-accent)" },
    { id: "archived", label: "Archived", count: 0, disabled: true },
  ]} /><Pill role="status">Viewing {view}</Pill></section>;
}
export const SegmentedChoices: Story = {
  render: () => <ViewSelection />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Mine 4" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Viewing mine");
    await expect(canvas.getByRole("button", { name: "Mine 4" })).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("button", { name: "Archived 0" })).toBeDisabled();
  },
};

export const Disclosure: Story = {
  render: ({ onAction }) => <section aria-label="Disclosure example" style={{ ...stack, minHeight: 260, justifyItems: "end" }}>
    <ExpandablePill panel={<Surface role="group" aria-label="Filter details" style={{ padding: 20, width: 260 }}>
      <Input label="Filter by name" placeholder="Start typing" />
      <GhostTextButton onClick={onAction}>Apply filter</GhostTextButton>
    </Surface>}>Filter details</ExpandablePill>
  </section>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Filter details" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const input = await canvas.findByRole("textbox", { name: "Filter by name" });
    await waitFor(() => expect(input).toBeVisible());
    await userEvent.tab();
    await expect(input).toHaveFocus();
    await userEvent.type(input, "Ada");
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard(" ");
    const reopened = await canvas.findByRole("textbox", { name: "Filter by name" });
    await waitFor(() => expect(reopened).toBeVisible());
    await expect(reopened).toHaveValue("Ada");
  },
};

function Preferences() {
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [color, setColor] = useState<string | null>(null);
  return <section aria-label="Theme preferences" data-bnh-theme={theme === "system" ? "dark" : theme}
    style={{ ...stack, padding: 24, background: "var(--bnh-bg)", color: "var(--bnh-text)", borderRadius: "var(--bnh-radius-lg)" }}>
    <h2>Appearance</h2>
    <ThemeToggle value={theme} onChange={setTheme} />
    <ColorPicker aria-label="Accent color" value={color} onChange={setColor} noneLabel="Default accent" colors={[
      { value: "#635bff", label: "Iris" }, { value: "#0f766e", label: "Teal" }, { value: "#b45309", label: "Amber", disabled: true },
    ]} />
    <Pill tint={color ?? undefined}>Your accent</Pill>
    <p role="status">Theme: {theme}. Accent: {color ?? "default"}.</p>
  </section>;
}
export const ThemeAndColor: Story = {
  render: () => <Preferences />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Light theme" }));
    await userEvent.click(canvas.getByRole("button", { name: "Teal" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("Theme: light. Accent: #0f766e.");
    await userEvent.click(canvas.getByRole("button", { name: "Default accent" }));
    await expect(canvas.getByRole("button", { name: "Default accent" })).toHaveAttribute("aria-pressed", "true");
  },
};
export const LightControls: Story = { ...NativeForm, globals: { theme: "light" } };

export const LightButtons: Story = { ...Buttons, globals: { theme: "light" } };
export const LightSelection: Story = { ...SegmentedChoices, globals: { theme: "light" } };
