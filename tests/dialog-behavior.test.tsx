import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../src/button.js";
import { ConfirmDialog } from "../src/confirm-dialog.js";
import { Input } from "../src/input.js";
import { Modal } from "../src/modal.js";

function EscapeOnMount({ onEscape }: { onEscape: () => void }) {
  const field = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    // Dispatch inside the opening commit: awaiting a settled dialog would miss
    // the registration/listener race this regression protects.
    field.current!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    onEscape();
  }, [onEscape]);
  return <Input ref={field} label="Opening field" />;
}

function ImmediateDialog({ nested = false, persistent = false, explicitContainer = false }: { nested?: boolean; persistent?: boolean; explicitContainer?: boolean }) {
  const [parent, setParent] = useState(false);
  const [child, setChild] = useState(false);
  const [count, setCount] = useState(0);
  const onEscape = useCallback(() => setCount((value) => value + 1), []);
  const content = <>
    <Button onClick={() => setChild(true)}>Mount immediate dialog</Button>
    {child && <Modal open onOpenChange={setChild} title="Immediate child" persistent={persistent} portalContainer={explicitContainer ? document.body : undefined}>
      <EscapeOnMount onEscape={onEscape} />
      <Button onClick={() => setChild(false)}>Finish child</Button>
    </Modal>}
    <output aria-label="Escape count">{count}</output>
  </>;
  return nested ? <Modal open={parent} onOpenChange={(value) => setParent(value)} title="Parent" trigger={<Button>Open parent</Button>}>{content}</Modal> : content;
}

function SimultaneousDialogs() {
  const [parent, setParent] = useState(false);
  const [child, setChild] = useState(false);
  const [count, setCount] = useState(0);
  const onEscape = useCallback(() => setCount((value) => value + 1), []);
  return <>
    <Button onClick={() => { setParent(true); setChild(true); }}>Mount both</Button>
    <output aria-label="Escape count">{count}</output>
    {parent && <Modal open onOpenChange={setParent} title="Simultaneous parent" portalContainer={document.body}>
      <Input label="Parent field" />
      {child && <Modal open onOpenChange={setChild} title="Simultaneous child" portalContainer={document.body}>
        <EscapeOnMount onEscape={onEscape} />
      </Modal>}
    </Modal>}
  </>;
}

describe("Modal opening Escape regressions", () => {
  it("closes a newly mounted dialog before Radix installs its first listener", async () => {
    const user = userEvent.setup();
    render(<ImmediateDialog explicitContainer />);
    const trigger = screen.getByRole("button", { name: "Mount immediate dialog" });
    for (let count = 1; count <= 3; count++) {
      await user.click(trigger);
      await waitFor(() => expect(screen.getByLabelText("Escape count")).toHaveTextContent(String(count)));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    }
  });

  it.each([false, true])("keeps the parent open through repeated child opening Escape (explicit container: %s)", async (explicitContainer) => {
    const user = userEvent.setup();
    render(<ImmediateDialog nested explicitContainer={explicitContainer} />);
    const parentTrigger = screen.getByRole("button", { name: "Open parent" });
    await user.click(parentTrigger);
    const trigger = screen.getByRole("button", { name: "Mount immediate dialog" });
    for (let count = 1; count <= 5; count++) {
      await user.click(trigger);
      await waitFor(() => expect(screen.getByLabelText("Escape count")).toHaveTextContent(String(count)));
      expect(screen.queryByRole("dialog", { name: "Immediate child" })).not.toBeInTheDocument();
      expect(screen.getByRole("dialog", { name: "Parent" })).toBeInTheDocument();
      await waitFor(() => expect(trigger).toHaveFocus());
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(parentTrigger).toHaveFocus());
  });

  it("lets a persistent opening child consume Escape without dismissing either dialog", async () => {
    const user = userEvent.setup();
    render(<ImmediateDialog nested persistent explicitContainer />);
    await user.click(screen.getByRole("button", { name: "Open parent" }));
    const trigger = screen.getByRole("button", { name: "Mount immediate dialog" });
    await user.click(trigger);
    expect(screen.getByLabelText("Escape count")).toHaveTextContent("1");
    const child = screen.getByRole("dialog", { name: "Immediate child" });
    await user.keyboard("{Escape}");
    expect(child).toBeInTheDocument();
    await user.click(within(child).getByRole("button", { name: "Finish child" }));
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Parent" })).toBeInTheDocument();
  });

  it("orders simultaneously mounted parent and child before opening Escape", async () => {
    const user = userEvent.setup();
    render(<SimultaneousDialogs />);
    const trigger = screen.getByRole("button", { name: "Mount both" });
    await user.click(trigger);
    expect(screen.getByLabelText("Escape count")).toHaveTextContent("1");
    expect(screen.queryByRole("dialog", { name: "Simultaneous child" })).not.toBeInTheDocument();
    const parent = screen.getByRole("dialog", { name: "Simultaneous parent" });
    await waitFor(() => expect(parent.contains(document.activeElement)).toBe(true));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe("ConfirmDialog", () => {
  it("requires an exact phrase plus app-owned prerequisites and prevents repeated loading actions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const props = { open: true, title: "Delete record", message: "This cannot be undone.", confirmLabel: "Delete", typeToConfirm: "DELETE", onConfirm, onCancel };
    const { rerender } = render(<ConfirmDialog {...props} confirmDisabled />);
    const field = screen.getByRole("textbox", { name: "Type DELETE to confirm" });
    const confirm = screen.getByRole("button", { name: "Delete" });
    await user.type(field, "DELETE");
    expect(confirm).toBeDisabled();
    rerender(<ConfirmDialog {...props} />);
    expect(confirm).toBeEnabled();
    await user.clear(field);
    await user.type(field, "delete");
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, "DELETE");
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(<ConfirmDialog {...props} loading />);
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    fireEvent.pointerDown(document.querySelector(".bnh-modal-backdrop")!);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: "Delete record" })).toBeInTheDocument();
  });

  it("clears the typed confirmation when closed and when the required phrase changes", async () => {
    const user = userEvent.setup();
    const props = { open: true, title: "Delete record", message: "This cannot be undone.", typeToConfirm: "DELETE", onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(<ConfirmDialog {...props} />);
    await user.type(screen.getByRole("textbox", { name: "Type DELETE to confirm" }), "DELETE");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
    rerender(<ConfirmDialog {...props} open={false} />);
    rerender(<ConfirmDialog {...props} />);
    expect(screen.getByRole("textbox", { name: "Type DELETE to confirm" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Type DELETE to confirm" }), "DELETE");
    rerender(<ConfirmDialog {...props} typeToConfirm="REMOVE" />);
    expect(screen.getByRole("textbox", { name: "Type REMOVE to confirm" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
