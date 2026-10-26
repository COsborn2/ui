import { createRef, useState } from "react";
import { createPortal } from "react-dom";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../src/button.js";
import { Input } from "../src/input.js";
import { Select } from "../src/select.js";
import { IconButton } from "../src/icon-button.js";
import { GhostTextButton } from "../src/ghost-text-button.js";
import { Pill } from "../src/pill.js";
import { ExpandablePill } from "../src/expandable-pill.js";
import { SegmentedControl } from "../src/segmented-control.js";
import { Switch } from "../src/switch.js";

describe("native form controls", () => {
  test("submits values through the native form and keeps utility buttons from submitting", async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(<form onSubmit={(event) => {
      event.preventDefault();
      submit(Object.fromEntries(new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter)));
    }}>
      <Input label="Name" name="name" />
      <Select label="Team" name="team" defaultValue="all" size="sm">
        <option value="all">All</option><option value="design">Design</option>
      </Select>
      <Switch name="notifications" value="enabled" label="Notifications" description="Email me updates" />
      <Button name="intent" value="save">Save</Button>
      <Button type="button">Cancel</Button>
      <IconButton aria-label="More options" />
      <GhostTextButton>Help</GhostTextButton>
    </form>);
    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.selectOptions(screen.getByRole("combobox", { name: "Team" }), "design");
    await user.click(screen.getByRole("switch", { name: "Notifications" }));
    expect(screen.getByRole("switch")).toHaveAccessibleDescription("Email me updates");
    for (const name of ["Cancel", "More options", "Help"]) await user.click(screen.getByRole("button", { name }));
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submit).toHaveBeenCalledWith({ name: "Ada", team: "design", notifications: "enabled", intent: "save" });
  });

  test("disabled fields and buttons cannot change values or submit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={onSubmit}>
      <Input label="Name" defaultValue="Ada" disabled onChange={onChange} />
      <Select label="Team" disabled onChange={onChange}><option>A</option><option>B</option></Select>
      <Switch label="Notifications" disabled onChange={onChange} />
      <Button disabled>Save</Button>
    </form>);
    await user.type(screen.getByLabelText("Name"), "Grace");
    await user.selectOptions(screen.getByRole("combobox"), "B");
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button"));
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("repeated labels focus distinct associated controls", async () => {
    const user = userEvent.setup();
    render(<><Input label="Name" /><Input label="Name" /><Select label="Name"><option>A</option></Select></>);
    const controls = screen.getAllByLabelText("Name");
    expect(new Set(controls.map((control) => control.id)).size).toBe(3);
    for (const [index, label] of screen.getAllByText("Name", { selector: "label" }).entries()) {
      await user.click(label);
      expect(controls[index]).toHaveFocus();
    }
  });

  test("errors augment caller help and disappear when corrected", () => {
    const { rerender } = render(<><p id="email-help">Use your work email.</p><Input id="email" label="Email" error="Enter a valid email." aria-describedby="email-help" /></>);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInvalid();
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Use your work email. Enter a valid email.");
    expect(screen.getByRole("textbox")).toHaveAttribute("id", "email");
    rerender(<><p id="email-help">Use your work email.</p><Input id="email" label="Email" aria-describedby="email-help" /></>);
    expect(screen.getByRole("textbox")).toBeValid();
    expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Use your work email.");
    expect(screen.queryByText("Enter a valid email.")).not.toBeInTheDocument();
  });

  test("Select exposes error descriptions and honors a caller invalid override", () => {
    render(<Select label="Plan" error="Choose a plan." aria-invalid={false}><option>Choose</option></Select>);
    expect(screen.getByRole("combobox", { name: "Plan" })).toHaveAccessibleDescription("Choose a plan.");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "false");
  });

  test("native refs support consumer focus and form integration", () => {
    const input = createRef<HTMLInputElement>();
    const select = createRef<HTMLSelectElement>();
    const button = createRef<HTMLButtonElement>();
    const toggle = createRef<HTMLInputElement>();
    render(<><Input ref={input} label="Name" /><Select ref={select} label="Plan"><option>Free</option></Select><Button ref={button}>Save</Button><Switch ref={toggle} label="Emails" /></>);
    expect(input.current).toBe(screen.getByLabelText("Name"));
    expect(select.current).toBe(screen.getByRole("combobox"));
    expect(button.current).toBe(screen.getByRole("button"));
    expect(toggle.current).toBe(screen.getByRole("switch"));
    input.current?.focus();
    expect(input.current).toHaveFocus();
  });
});

describe("ExpandablePill disclosure", () => {
  test("opens from the keyboard, closes with Escape in its panel, and restores focus", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<ExpandablePill onOpenChange={changed} panel={<button type="button">Panel action</button>}>Details</ExpandablePill>);
    const trigger = screen.getByRole("button", { name: "Details" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Panel action" })).not.toBeInTheDocument();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(trigger.getAttribute("aria-controls")!)).toContainElement(screen.getByRole("button", { name: "Panel action" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Panel action" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(changed.mock.calls).toEqual([[true], [false], [true]]);
  });

  test("controlled state changes only when its parent updates the value", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const { rerender } = render(<ExpandablePill open={false} defaultOpen onOpenChange={changed} panel="Panel">Details</ExpandablePill>);
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(changed).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
    rerender(<ExpandablePill open onOpenChange={changed} panel="Panel">Details</ExpandablePill>);
    expect(screen.getByText("Panel")).toBeVisible();
  });

  test("caller preventDefault cancels click toggles and trigger Escape", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const { rerender } = render(<ExpandablePill onClick={(event) => event.preventDefault()} onOpenChange={changed} panel="Panel">Details</ExpandablePill>);
    await user.click(screen.getByRole("button"));
    expect(changed).not.toHaveBeenCalled();
    rerender(<ExpandablePill defaultOpen open onKeyDown={(event) => event.preventDefault()} onOpenChange={changed} panel="Panel">Details</ExpandablePill>);
    await user.keyboard("{Escape}");
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  test("nested controls can consume Escape without closing the disclosure", async () => {
    const user = userEvent.setup();
    render(<ExpandablePill defaultOpen panel={<Input label="Filter" onKeyDown={(event) => { if (event.key === "Escape") event.preventDefault(); }} />}>Details</ExpandablePill>);
    await user.click(screen.getByLabelText("Filter"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Filter")).toHaveFocus();
  });

  test("Escape in a portaled child does not close the ancestor disclosure", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<ExpandablePill defaultOpen onOpenChange={changed}
      panel={createPortal(<button type="button">Portaled action</button>, document.body)}>Details</ExpandablePill>);
    const action = screen.getByRole("button", { name: "Portaled action" });
    await user.click(action);
    await user.keyboard("{Escape}");
    expect(action).toHaveFocus();
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
    expect(changed).not.toHaveBeenCalled();
  });

  test("nested disclosures close one level at a time", async () => {
    const user = userEvent.setup();
    render(<ExpandablePill defaultOpen panel={<ExpandablePill defaultOpen panel={<Input label="Nested field" />}>Inner</ExpandablePill>}>Outer</ExpandablePill>);
    await user.click(screen.getByLabelText("Nested field"));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Inner" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Inner" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Outer" })).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Outer" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Outer" })).toHaveAttribute("aria-expanded", "false");
  });

  test("defaults to a non-submitting button but accepts an explicit submit type", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event) => event.preventDefault());
    const { rerender } = render(<form onSubmit={submit}><ExpandablePill panel="Panel">Details</ExpandablePill></form>);
    await user.click(screen.getByRole("button"));
    expect(submit).not.toHaveBeenCalled();
    rerender(<form onSubmit={submit}><ExpandablePill type="submit" panel="Panel">Details</ExpandablePill></form>);
    await user.click(screen.getByRole("button"));
    expect(submit).toHaveBeenCalledOnce();
  });

  test("a disabled disclosure cannot open", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<ExpandablePill disabled onOpenChange={changed} panel="Panel">Details</ExpandablePill>);
    await user.click(screen.getByRole("button"));
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("status and selection", () => {
  test("Pill exposes text without adding a disclosure or focus target", async () => {
    const user = userEvent.setup();
    render(<><Pill role="status">Ready</Pill><Button>Continue</Button></>);
    expect(screen.getByRole("status")).toHaveTextContent("Ready");
    await user.tab();
    expect(screen.getByRole("button", { name: "Continue" })).toHaveFocus();
  });

  test("segmented choices update through their parent and skip disabled options", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    function ViewPicker() {
      const [view, setView] = useState("all");
      return <SegmentedControl aria-label="View" items={[{ id: "all", label: "All" }, { id: "mine", label: "Mine" }, { id: "archived", label: "Archived", disabled: true }]} value={view} onChange={(value) => { changed(value); setView(value); }} />;
    }
    render(<ViewPicker />);
    await user.click(screen.getByRole("button", { name: "Mine" }));
    expect(screen.getByRole("button", { name: "Mine" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Archived" }));
    expect(changed).toHaveBeenCalledExactlyOnceWith("mine");
  });
});
