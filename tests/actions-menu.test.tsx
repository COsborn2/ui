import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionsMenu } from "../src/actions-menu.js";
import { Button } from "../src/button.js";

describe("ActionsMenu", () => {
  test("provides an accessible non-submit trigger and opens its menu on demand", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><ActionsMenu items={[{ label: "Rename", onClick: vi.fn() }]} /></form>);
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByRole("menu")).toBeVisible();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(submit).not.toHaveBeenCalled();
  });

  test("skips disabled items with the keyboard and selects without activating its parent", async () => {
    const user = userEvent.setup();
    const rename = vi.fn();
    const archive = vi.fn();
    const remove = vi.fn();
    const parentClick = vi.fn();
    const parentKey = vi.fn();
    render(<div onClick={parentClick} onKeyDown={parentKey}><ActionsMenu items={[
      { label: "Rename", onClick: rename },
      { label: "Archive", onClick: archive, disabled: true },
      { label: "Delete", onClick: remove, variant: "danger" },
    ]} /></div>);
    const trigger = screen.getByRole("button", { name: "More actions" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus());
    expect(screen.getByRole("menuitem", { name: "Archive" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledOnce();
    expect(rename).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentKey).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  test("does not select disabled actions through a pointer event", async () => {
    const select = vi.fn();
    render(<ActionsMenu defaultOpen items={[{ label: "Unavailable action", disabled: true, onClick: select }]} />);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unavailable action" }));
    expect(select).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeVisible();
  });

  test("disables empty and explicitly unavailable menus, including controlled open requests", () => {
    render(<><ActionsMenu ariaLabel="Empty actions" items={[]} /><ActionsMenu ariaLabel="Unavailable actions" disabled open
      items={[{ label: "Rename", onClick: vi.fn() }]} /></>);
    expect(screen.getByRole("button", { name: "Empty actions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unavailable actions" })).toBeDisabled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("preserves a custom trigger's name and requests controlled state changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const items = [{ label: "Rename", onClick: vi.fn() }];
    const { rerender } = render(<ActionsMenu open={false} onOpenChange={onOpenChange} items={items} trigger={<Button>Account actions</Button>} />);
    const trigger = screen.getByRole("button", { name: "Account actions" });
    await user.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    rerender(<ActionsMenu open onOpenChange={onOpenChange} items={items} trigger={<Button>Account actions</Button>} />);
    expect(await screen.findByRole("menu")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("menu")).toBeVisible();
    rerender(<ActionsMenu open={false} onOpenChange={onOpenChange} items={items} trigger={<Button>Account actions</Button>} />);
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
});
