import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../src/button.js";
import { ConfirmDialog, type ConfirmDialogProps } from "../src/confirm-dialog.js";
import { Input } from "../src/input.js";

const meta = {
  title: "Overlays/ConfirmDialog",
  component: ConfirmDialog,
  args: {
    open: false,
    title: "Delete workspace",
    message: "This permanently removes the workspace and its records.",
    typeToConfirm: "DELETE",
    confirmLabel: "Delete workspace",
    confirmVariant: "danger",
    onConfirm: fn(),
    onCancel: fn(),
  },
  parameters: {
    layout: "centered",
    docs: { story: { inline: false, height: "600px" } },
    // The examples own opening, loading, prerequisites, and completion callbacks.
    controls: { include: ["title", "message", "confirmLabel", "confirmVariant", "typeToConfirm"] },
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

function ConfirmationExample(args: ConfirmDialogProps) {
  const [open, setOpen] = useState(args.open);
  const [count, setCount] = useState(0);
  return <>
    <Button onClick={() => setOpen(true)}>Open confirmation</Button>
    <output aria-label="Confirmed deletions">{count}</output>
    <ConfirmDialog {...args} open={open}
      onCancel={() => { args.onCancel(); setOpen(false); }}
      onConfirm={() => { args.onConfirm(); setCount((value) => value + 1); setOpen(false); }} />
  </>;
}

export const TypedConfirmation: Story = {
  render: (args) => <ConfirmationExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Open confirmation" });
    await userEvent.click(trigger);
    let dialog = await body.findByRole("dialog", { name: "Delete workspace" });
    let field = within(dialog).getByRole("textbox", { name: "Type DELETE to confirm" });
    let confirm = within(dialog).getByRole("button", { name: "Delete workspace" });
    await expect(confirm).toBeDisabled();
    await userEvent.type(field, "delete");
    await expect(confirm).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "DELETE");
    await expect(confirm).toBeEnabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    dialog = await body.findByRole("dialog", { name: "Delete workspace" });
    field = within(dialog).getByRole("textbox", { name: "Type DELETE to confirm" });
    confirm = within(dialog).getByRole("button", { name: "Delete workspace" });
    await expect(field).toHaveValue("");
    await expect(confirm).toBeDisabled();
    await userEvent.type(field, "DELETE");
    await userEvent.click(confirm);
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(canvas.getByLabelText("Confirmed deletions")).toHaveTextContent("1");
  },
};

function GuardedConfirmationExample(args: ConfirmDialogProps) {
  const [open, setOpen] = useState(args.open);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  return <>
    <Button onClick={() => { setPassword(""); setOpen(true); }}>Open guarded confirmation</Button>
    <ConfirmDialog {...args} open={open} loading={loading} confirmDisabled={password.length === 0}
      onCancel={() => { args.onCancel(); setOpen(false); }}
      onConfirm={() => { args.onConfirm(); setLoading(true); }}>
      <Input label="Verification password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
      {loading && <Button onClick={() => { setLoading(false); setOpen(false); }}>Complete verification</Button>}
    </ConfirmDialog>
  </>;
}

export const PrerequisitesAndLoading: Story = {
  render: (args) => <GuardedConfirmationExample {...args} />,
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Open guarded confirmation" }));
    const dialog = await body.findByRole("dialog", { name: "Delete workspace" });
    const field = within(dialog).getByRole("textbox", { name: "Type DELETE to confirm" });
    const confirm = within(dialog).getByRole("button", { name: "Delete workspace" });
    await userEvent.type(field, "DELETE");
    await expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Verification password"), "example-password");
    await expect(confirm).toBeEnabled();
    await userEvent.clear(field);
    await userEvent.type(field, "delete");
    await expect(confirm).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, "DELETE");
    await userEvent.click(confirm);
    await expect(within(dialog).getByRole("button", { name: "Loading..." })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(document.querySelector<HTMLElement>(".bnh-modal-backdrop")!);
    await expect(dialog).toBeVisible();
    await expect(args.onCancel).not.toHaveBeenCalled();
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Complete verification" }));
    await waitFor(() => expect(body.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const Loading: Story = {
  args: { open: true, loading: true },
  play: async ({ canvasElement }) => {
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", { name: "Delete workspace" });
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(within(dialog).getByRole("button", { name: "Loading..." })).toBeDisabled();
    await expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    await expect(dialog).toBeVisible();
  },
};
