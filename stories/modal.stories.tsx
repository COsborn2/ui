import type { Meta, StoryObj } from "@storybook/react-vite";
import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/button.js";
import { Input } from "../src/input.js";
import { Modal, type ModalProps } from "../src/modal.js";

const meta = {
  title: "Overlays/Modal",
  component: Modal,
  parameters: {
    layout: "centered",
    // Body portals need their own document so they cannot cover the docs page.
    docs: { story: { inline: false, height: "600px" } },
    // The example owns open state, its trigger, form fields, and footer.
    controls: { include: ["title", "subtitle", "ariaLabel", "persistent", "width", "zIndex", "theme"] },
  },
  args: { open: false, onOpenChange: fn(), children: "Dialog content" },
} satisfies Meta<typeof Modal>;
export default meta;
type Story = StoryObj<typeof meta>;

// These composition/regression examples intentionally own all their props.
const fixtureParameters = { controls: { include: [] } };

function ControlledModal(args: ModalProps) {
  const [open, setOpen] = useState(args.open);
  return <Modal {...args} open={open} onOpenChange={(value) => { setOpen(value); args.onOpenChange(value); }}
    trigger={<Button>Open dialog</Button>}
    footer={<Button onClick={() => setOpen(false)}>Done</Button>}>
    <Input label="Display name" defaultValue="Alex" />
    <Input label="Description" />
  </Modal>;
}

export const OpenDialog: Story = {
  args: { open: true, title: "Edit profile", subtitle: "Update your public profile." },
  render: (args) => <ControlledModal {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Edit profile" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(dialog).toHaveAccessibleDescription("Update your public profile.");
  },
};

export const FocusAndDismissal: Story = {
  args: { title: "Edit profile", subtitle: "Focus remains in this dialog until you finish." },
  render: (args) => <ControlledModal {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Open dialog" });
    const originalOverflow = getComputedStyle(document.body).overflow;
    await userEvent.click(trigger);
    const dialog = await body.findByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toHaveAccessibleDescription("Focus remains in this dialog until you finish.");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await waitFor(() => expect(getComputedStyle(document.body).overflow).toBe("hidden"));
    for (const shift of [false, true]) {
      for (let index = 0; index < 6; index++) {
        await userEvent.tab({ shift });
        await expect(dialog.contains(document.activeElement)).toBe(true);
      }
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(getComputedStyle(document.body).overflow).toBe(originalOverflow);
    await userEvent.click(trigger);
    await body.findByRole("dialog", { name: "Edit profile" });
    await userEvent.click(document.querySelector<HTMLElement>(".bnh-modal-backdrop")!);
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const Persistent: Story = {
  args: { title: "Finish this step", persistent: true },
  render: (args) => <ControlledModal {...args} />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open dialog" }));
    const dialog = await body.findByRole("dialog", { name: "Finish this step" });
    await expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.querySelector<HTMLElement>(".bnh-modal-backdrop")!);
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

function NestedExample({ radix = false }: { radix?: boolean }) {
  const [parent, setParent] = useState(false);
  const [child, setChild] = useState(false);
  return <Modal open={parent} onOpenChange={(value) => setParent(value)} title="Parent dialog" trigger={<Button>Open parent</Button>}>
    <Input label="Parent name" />
    {radix ? <Dialog.Root open={child} onOpenChange={setChild}>
      <Dialog.Trigger asChild><Button>Open child</Button></Dialog.Trigger>
      <Dialog.Portal><Dialog.Content className="bnh-modal" style={{ zIndex: 101, padding: 24 }} aria-describedby={undefined}>
        <Dialog.Title>Child dialog</Dialog.Title><Input label="Child name" />
        <Dialog.Close asChild><Button>Close child</Button></Dialog.Close>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root> : <Modal open={child} onOpenChange={setChild} title="Child dialog" trigger={<Button>Open child</Button>}>
      <Input label="Child name" />
    </Modal>}
  </Modal>;
}

const nestedPlay: Story["play"] = async ({ canvasElement }) => {
  const body = within(canvasElement.ownerDocument.body);
  const parentTrigger = within(canvasElement).getByRole("button", { name: "Open parent" });
  for (let iteration = 0; iteration < 3; iteration++) {
    await userEvent.click(parentTrigger);
    const childTrigger = body.getByRole("button", { name: "Open child" });
    await userEvent.click(childTrigger);
    const child = await body.findByRole("dialog", { name: "Child dialog" });
    await waitFor(() => expect(child.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog", { name: "Child dialog" })).not.toBeInTheDocument());
    await waitFor(() => expect(body.getByRole("dialog", { name: "Parent dialog" })).toBeVisible());
    await waitFor(() => expect(childTrigger).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(parentTrigger).toHaveFocus());
  }
};

export const NestedDialogs: Story = { parameters: fixtureParameters, render: () => <NestedExample />, play: nestedPlay };
export const RadixInteroperability: Story = { parameters: fixtureParameters, render: () => <NestedExample radix />, play: nestedPlay };

function OpeningEscape({ onEscape }: { onEscape: () => void }) {
  const target = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // Input arrives during the opening commit, before passive Radix listeners.
    // Waiting for a visible dialog would mask this race.
    target.current!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    onEscape();
  }, [onEscape]);
  return <Input ref={target} label="Child name" />;
}

function RapidNestedExample({ persistent = false }: { persistent?: boolean }) {
  const [parent, setParent] = useState(false);
  const [child, setChild] = useState(false);
  const [count, setCount] = useState(0);
  const onEscape = useCallback(() => setCount((value) => value + 1), []);
  return <Modal open={parent} onOpenChange={(value) => setParent(value)} title="Parent dialog" trigger={<Button>Open parent</Button>}>
    <Button onClick={() => setChild(true)}>Open child with immediate Escape</Button>
    {child && <Modal open onOpenChange={setChild} title="Child dialog" persistent={persistent} portalContainer={document.body}>
      <OpeningEscape onEscape={onEscape} />
      <Button onClick={() => setChild(false)}>Finish child</Button>
    </Modal>}
    <output aria-label="Opening escapes">{count}</output>
  </Modal>;
}

export const ImmediateNestedEscape: Story = {
  parameters: fixtureParameters,
  render: () => <RapidNestedExample />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const parentTrigger = within(canvasElement).getByRole("button", { name: "Open parent" });
    await userEvent.click(parentTrigger);
    const trigger = body.getByRole("button", { name: "Open child with immediate Escape" });
    for (let count = 1; count <= 5; count++) {
      await userEvent.click(trigger);
      await waitFor(() => expect(body.getByLabelText("Opening escapes")).toHaveTextContent(String(count)));
      await expect(body.queryByRole("dialog", { name: "Child dialog" })).not.toBeInTheDocument();
      await waitFor(() => expect(body.getByRole("dialog", { name: "Parent dialog" })).toBeVisible());
      await waitFor(() => expect(trigger).toHaveFocus());
    }
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(parentTrigger).toHaveFocus());
  },
};

export const PersistentNestedEscape: Story = {
  parameters: fixtureParameters,
  render: () => <RapidNestedExample persistent />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open parent" }));
    const trigger = body.getByRole("button", { name: "Open child with immediate Escape" });
    await userEvent.click(trigger);
    const child = await body.findByRole("dialog", { name: "Child dialog" });
    await expect(body.getByLabelText("Opening escapes")).toHaveTextContent("1");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(child).toBeVisible());
    await userEvent.click(within(child).getByRole("button", { name: "Finish child" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await waitFor(() => expect(body.getByRole("dialog", { name: "Parent dialog" })).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

function HandoffExample() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  return <>
    <Modal open={first} onOpenChange={setFirst} title="First dialog" trigger={<Button>Open first</Button>}>
      <Button onClick={() => { setFirst(false); setSecond(true); }}>Continue</Button>
    </Modal>
    <Modal open={second} onOpenChange={setSecond} title="Second dialog">
      <Input label="Second field" autoFocus />
    </Modal>
  </>;
}

export const FocusHandoff: Story = {
  parameters: fixtureParameters,
  render: () => <HandoffExample />,
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open first" }));
    await userEvent.click(body.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(body.queryByRole("dialog", { name: "First dialog" })).not.toBeInTheDocument());
    await waitFor(() => expect(body.getByRole("textbox", { name: "Second field" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
  },
};

function ScopedThemeExample() {
  const [open, setOpen] = useState(false);
  const [contained, setContained] = useState(false);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <section data-bnh-theme="light" aria-label="Light theme scope" style={{ "--bnh-accent": "rgb(12, 34, 56)" } as CSSProperties}>
    <Modal open={open} onOpenChange={setOpen} title="Inherited theme" trigger={<Button>Open themed dialog</Button>}>
      <p>The body portal inherits tokens from this light theme scope.</p>
    </Modal>
    <Modal open={contained} onOpenChange={setContained} title="Container theme" portalContainer={container} trigger={<Button>Open contained dialog</Button>}>
      <p>This portal renders in the explicit container.</p>
    </Modal>
    <div ref={setContainer} data-testid="portal-container" />
  </section>;
}

export const ScopedPortalThemes: Story = {
  parameters: fixtureParameters,
  render: () => <ScopedThemeExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const scope = canvas.getByRole("region", { name: "Light theme scope" });
    await userEvent.click(canvas.getByRole("button", { name: "Open themed dialog" }));
    const dialog = await body.findByRole("dialog", { name: "Inherited theme" });
    await expect(scope.contains(dialog)).toBe(false);
    await waitFor(() => expect(getComputedStyle(dialog).getPropertyValue("--bnh-accent").trim()).toBe("rgb(12, 34, 56)"));
    scope.style.setProperty("--bnh-accent", "rgb(65, 43, 21)");
    await waitFor(() => expect(getComputedStyle(dialog).getPropertyValue("--bnh-accent").trim()).toBe("rgb(65, 43, 21)"));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Open contained dialog" }));
    const contained = await body.findByRole("dialog", { name: "Container theme" });
    await expect(canvas.getByTestId("portal-container")).toContainElement(contained);
    await expect(getComputedStyle(contained).getPropertyValue("--bnh-accent").trim()).toBe("rgb(65, 43, 21)");
    await userEvent.keyboard("{Escape}");
  },
};
