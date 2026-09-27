import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ActionsMenu } from "../src/actions-menu.js";
import { Button } from "../src/button.js";
import { Input } from "../src/input.js";
import { Modal } from "../src/modal.js";

const meta = {
  title: "Overlays/ActionsMenu",
  component: ActionsMenu,
  args: { items: [] },
  parameters: { layout: "padded", docs: { story: { inline: false, height: "400px" } } },
} satisfies Meta<typeof ActionsMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

function RecordActions() {
  const [selected, setSelected] = useState("No action selected");
  const [rowActivations, setRowActivations] = useState(0);
  const items = [
    { label: "Rename record", onClick: () => setSelected("Record renamed") },
    { label: "Archive record", disabled: true, onClick: () => setSelected("Record archived") },
    { label: "Delete record", variant: "danger" as const, onClick: () => setSelected("Record deleted") },
  ];
  return <section aria-label="Record action examples">
    <h2>Record actions</h2>
    <div onClick={() => setRowActivations((count) => count + 1)} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") setRowActivations((count) => count + 1);
    }}>
      <ActionsMenu ariaLabel="Record actions" items={items} />
    </div>
    <p>{selected}</p>
    <p>Row activations: {rowActivations}</p>
    <ActionsMenu ariaLabel="Unavailable actions" disabled items={items} />
    <ActionsMenu ariaLabel="Empty actions" items={[]} />
  </section>;
}

export const KeyboardAndDisabledActions: Story = {
  render: () => <RecordActions />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Record actions" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(page.getByRole("menuitem", { name: "Rename record" })).toHaveFocus());
    await expect(page.getByRole("menuitem", { name: "Archive record" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.keyboard("{ArrowDown}");
    await expect(page.getByRole("menuitem", { name: "Delete record" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    await expect(page.getByRole("menuitem", { name: "Rename record" })).toHaveFocus();
    await userEvent.keyboard("del");
    await waitFor(() => expect(page.getByRole("menuitem", { name: "Delete record" })).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await expect(canvas.getByText("Record deleted")).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard(" ");
    await expect(await page.findByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(canvas.getByText("Row activations: 0")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Unavailable actions" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Empty actions" })).toBeDisabled();
  },
};

function MenuToDialog() {
  const [open, setOpen] = useState(false);
  return <>
    <ActionsMenu trigger={<Button>Account actions</Button>} items={[
      { label: "Edit account", onClick: () => setOpen(true) },
    ]} />
    <Modal open={open} onOpenChange={setOpen} title="Edit account" subtitle="Update your display name.">
      <Input label="Display name" defaultValue="Alex Morgan" />
      <Button onClick={() => setOpen(false)}>Save account</Button>
    </Modal>
  </>;
}

export const OpensDialogWithoutStealingFocus: Story = {
  render: () => <MenuToDialog />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Account actions" }));
    await userEvent.click(await page.findByRole("menuitem", { name: "Edit account" }));
    const dialog = await page.findByRole("dialog", { name: "Edit account" });
    await waitFor(() => expect(dialog).toBeVisible());
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await waitFor(() => expect(dialog.contains(canvasElement.ownerDocument.activeElement)).toBe(true));
    await userEvent.clear(within(dialog).getByRole("textbox", { name: "Display name" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Display name" }), "Taylor");
    await expect(within(dialog).getByRole("textbox", { name: "Display name" })).toHaveValue("Taylor");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

// Dispatch during the portal's first layout effect, before deferred listeners attach.
function ImmediateEscape({ report }: { report: () => void }) {
  const target = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    target.current?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    report();
  }, [report]);
  return <span ref={target}>!</span>;
}

function NestedMenu() {
  const [dialog, setDialog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rapid, setRapid] = useState(false);
  const [conditional, setConditional] = useState(false);
  const [escapes, setEscapes] = useState(0);
  const report = useCallback(() => setEscapes((count) => count + 1), []);
  return <Modal open={dialog} onOpenChange={setDialog} title="Record details" subtitle="Actions affect this record."
    trigger={<Button>Open record details</Button>}>
    <Input label="Record name" defaultValue="Weekly review" />
    <ActionsMenu ariaLabel="Dialog actions" open={menu} onOpenChange={setMenu} items={[
      { label: "Keep parent open", onClick: () => {}, icon: rapid ? <ImmediateEscape report={report} /> : undefined },
    ]} />
    <Button onClick={() => { setRapid(true); setMenu(true); }}>Open menu with immediate Escape</Button>
    <Button onClick={() => setConditional(true)}>Mount menu with immediate Escape</Button>
    {conditional && <ActionsMenu ariaLabel="Conditional actions" open onOpenChange={setConditional} portalContainer={document.body} items={[
      { label: "Conditional action", onClick: () => {}, icon: <ImmediateEscape report={report} /> },
    ]} />}
    <p>Immediate escapes: {escapes}</p>
  </Modal>;
}

export const NestedEscapeAndRapidOpen: Story = {
  parameters: { docs: { description: { story: "Escape closes only the topmost menu, including during the first commit. The parent dialog keeps focus until its own dismissal." } } },
  render: () => <NestedMenu />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const open = canvas.getByRole("button", { name: "Open record details" });
    await userEvent.click(open);
    const parent = await page.findByRole("dialog", { name: "Record details" });
    await waitFor(() => expect(parent).toBeVisible());
    const trigger = within(parent).getByRole("button", { name: "Dialog actions" });
    await userEvent.click(trigger);
    await expect(await page.findByRole("menu")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("menu")).not.toBeInTheDocument());
    await expect(parent).toBeVisible();
    await waitFor(() => expect(trigger).toHaveFocus());
    for (const [index, label] of ["Open menu with immediate Escape", "Mount menu with immediate Escape", "Open menu with immediate Escape"].entries()) {
      await userEvent.click(within(parent).getByRole("button", { name: label }));
      await waitFor(() => expect(within(parent).getByText(`Immediate escapes: ${index + 1}`)).toBeVisible());
      await expect(page.queryByRole("menu")).not.toBeInTheDocument();
      await expect(parent).toBeVisible();
      await waitFor(() => expect(parent.contains(canvasElement.ownerDocument.activeElement)).toBe(true));
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(page.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(open).toHaveFocus());
  },
};

// Keep content mounted after play so the automatic accessibility scan includes the portal.
export const OpenMenu: Story = {
  parameters: {
    // Axe recognizes modal dialogs but not Radix's modal role="menu". Its static
    // aria-hidden-focus check flags the background trigger despite the focus trap.
    // Scan every rule on the active menu and verify background isolation below.
    // Other stories retain the global document-wide accessibility context.
    a11y: { context: '[role="menu"]' },
    docs: { description: { story: "Accessibility rules inspect the active menu. Axe does not recognize modal menus when checking hidden background controls, so interaction assertions separately verify Tab, Shift+Tab, and programmatic focus cannot leave the open menu." } },
  },
  args: {
    ariaLabel: "Record actions",
    open: true,
    onOpenChange: fn(),
    items: [
      { label: "Rename record", onClick: fn() },
      { label: "Archive record", disabled: true, onClick: fn() },
      { label: "Delete record", variant: "danger", onClick: fn() },
    ],
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByRole("menu")).toBeVisible());
    await expect(page.getByRole("menuitem", { name: "Rename record" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete record" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Archive record" })).toHaveAttribute("aria-disabled", "true");
    const menu = page.getByRole("menu");
    const document = canvasElement.ownerDocument;
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
    await userEvent.tab();
    await expect(menu.contains(document.activeElement)).toBe(true);
    await userEvent.tab({ shift: true });
    await expect(menu.contains(document.activeElement)).toBe(true);
    const trigger = within(canvasElement).getByRole("button", { hidden: true });
    trigger.focus();
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
    await expect(trigger).not.toHaveFocus();
  },
};

export const OpenMenuLight: Story = {
  ...OpenMenu,
  globals: { theme: "light" },
};
