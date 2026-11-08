import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/button.js";
import { HeaderShell } from "../src/header-shell.js";
import { Input } from "../src/input.js";
import { Modal } from "../src/modal.js";
import { Pill } from "../src/pill.js";
import { Select } from "../src/select.js";
import { Surface } from "../src/surface.js";
import { Switch } from "../src/switch.js";
import "./theming.css";

const meta = {
  title: "Theming/Application theme",
  parameters: {
    layout: "padded",
    docs: { story: { inline: false, height: "640px" } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function OutlineThemeExample() {
  const [open, setOpen] = useState(false);
  return <section aria-label="Outline theme" data-bnh-theme="light" className="story-outline-theme">
    <HeaderShell as="header" aria-label="Themed header" width="full"
      left={<strong>Outline theme</strong>} right={<Pill tint="var(--bnh-green)">Live</Pill>} />
    <Surface style={{ display: "grid", gap: 16, padding: 24 }}>
      <Input label="Project name" defaultValue="Launch plan" />
      <Select label="Visibility" defaultValue="Team"><option>Team</option><option>Public</option></Select>
      <Switch label="Email updates" description="Receive a weekly summary." defaultChecked />
      <div style={{ display: "flex", gap: 12 }}>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Button variant="secondary">Cancel</Button>
      </div>
    </Surface>
    <Modal open={open} onOpenChange={setOpen} title="Themed dialog" subtitle="Portaled content keeps the region's tokens."
      footer={<Button onClick={() => setOpen(false)}>Done</Button>}>
      <p style={{ margin: 0 }}>The dialog renders in the document body.</p>
    </Modal>
  </section>;
}

const px = (element: Element, property: string) => getComputedStyle(element).getPropertyValue(property);

export const OutlineTheme: Story = {
  render: () => <OutlineThemeExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const primary = canvas.getByRole("button", { name: "Open dialog" });
    await expect(px(primary, "border-top-width")).toBe("2px");
    await expect(px(primary, "border-top-left-radius")).toBe("4px");
    await expect(px(primary, "box-shadow")).toContain("3px 3px 0px");
    await expect(px(primary, "color")).toBe("rgb(17, 17, 17)");

    // A tinted pill's border was an inline declaration; an app rule now wins.
    await expect(px(canvas.getByText("Live"), "border-top-color")).toBe("rgb(17, 17, 17)");
    // The header's padding and position were inline too.
    const header = canvas.getByRole("banner", { name: "Themed header" });
    await expect(px(header, "padding-left")).toBe("20px");
    await expect(px(header, "position")).toBe("static");
    await expect(px(header, "backdrop-filter")).toBe("none");

    const select = canvas.getByRole("combobox", { name: "Visibility" });
    await expect(px(select.nextElementSibling!, "color")).toBe("rgb(61, 57, 52)");

    await userEvent.click(primary);
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Themed dialog" });
    await waitFor(() => expect(px(dialog, "border-top-width")).toBe("2px"));
    await expect(px(dialog, "backdrop-filter")).toBe("none");
    await expect(px(dialog, "box-shadow")).toContain("6px 6px 0px");
    await expect(px(within(dialog).getByRole("heading", { name: "Themed dialog" }), "font-weight")).toBe("800");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(canvasElement.ownerDocument.querySelector("[role=dialog]")).toBeNull());
  },
};

const track = (element: HTMLElement) => element.nextElementSibling!;
const thumbShift = (element: HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(track(element), "::after").transform).m41;
const mark = (element: HTMLElement) => getComputedStyle(track(element), "::before");
const TRANSPARENT = "rgba(0, 0, 0, 0)";

export const SlideSwitch: Story = {
  render: () => <div style={{ display: "grid", gap: 24 }}>
    <section aria-label="Default switch" style={{ display: "grid", gap: 12 }}>
      <Switch label="Default off" />
      <Switch label="Default on" defaultChecked />
    </section>
    <section aria-label="Slide switch" data-bnh-theme="light" className="story-outline-theme">
      <Switch label="Pulse check" description="Capture team mood." defaultChecked />
      <Switch label="Anonymous" description="Hide who wrote what." />
      <Switch label="Managed" description="Set by your administrator." disabled defaultChecked />
    </section>
  </div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Untouched tokens keep the frameless pill: no frame, grip or marks.
    const plainOn = canvas.getByRole("switch", { name: "Default on" });
    await waitFor(() => expect(thumbShift(plainOn)).toBe(16));
    await expect(px(track(plainOn), "border-top-width")).toBe("0px");
    await expect(px(track(plainOn), "box-shadow")).toBe("none");
    await expect(mark(plainOn).backgroundColor).toBe(TRANSPARENT);
    await expect(mark(canvas.getByRole("switch", { name: "Default off" })).borderTopColor).toBe(TRANSPARENT);

    // The slide switch: a 2px frame the thumb's travel stays inside
    // (50 − 2×2 − 18 − 2×2 = 24), a hard shadow, ridges and I/O marks.
    const on = canvas.getByRole("switch", { name: "Pulse check" });
    await expect(px(track(on), "border-top-width")).toBe("2px");
    await expect(px(track(on), "box-shadow")).toContain("2px 2px 0px");
    await waitFor(() => expect(thumbShift(on)).toBe(24));
    await expect(getComputedStyle(track(on), "::after").backgroundImage).toContain("rgb(17, 17, 17)");
    await expect(mark(on).width).toBe("2px");
    await expect(mark(on).left).toBe("12px");
    await expect(mark(on).backgroundColor).toBe("rgb(17, 17, 17)");

    const off = canvas.getByRole("switch", { name: "Anonymous" });
    await expect(thumbShift(off)).toBe(0);
    await expect(mark(off).width).toBe("10px");
    await expect(mark(off).left).toBe("28px");
    await expect(mark(off).borderTopColor).toBe("rgb(61, 57, 52)");

    // The mark follows the native checked state.
    await userEvent.click(off);
    await expect(off).toBeChecked();
    await waitFor(() => expect(thumbShift(off)).toBe(24));
    await expect(mark(off).backgroundColor).toBe("rgb(17, 17, 17)");
    await expect(canvas.getByRole("switch", { name: "Managed" })).toBeDisabled();
  },
};

export const RootOverridesEveryTheme: Story = {
  render: () => <p>A <code>:root</code> token override applies under the dark and light palettes.</p>,
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement;
    const orange = () => getComputedStyle(root).getPropertyValue("--bnh-orange").trim();
    await expect(orange()).toBe("rgb(1, 2, 3)");
    root.classList.add("light");
    try {
      await expect(orange()).toBe("rgb(1, 2, 3)");
    } finally {
      root.classList.remove("light");
    }
  },
};
