import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeaderShell } from "../src/header-shell.js";
import { Surface } from "../src/surface.js";
import { GlassPopoverSurface } from "../src/glass-popover-surface.js";
import { Skeleton } from "../src/skeleton.js";

describe("layout composition", () => {
  test("a named header exposes both slots and forwards consumer refs", async () => {
    const user = userEvent.setup();
    const account = vi.fn();
    const ref = createRef<HTMLElement>();
    render(<HeaderShell as="header" ref={ref} aria-label="Account navigation" tabIndex={-1}
      left={<a href="/">Home</a>} right={<button onClick={account}>Account</button>} />);
    const header = screen.getByRole("banner", { name: "Account navigation" });
    expect(ref.current).toBe(header);
    expect(within(header).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    await user.click(within(header).getByRole("button", { name: "Account" }));
    expect(account).toHaveBeenCalledOnce();
    ref.current?.focus();
    expect(header).toHaveFocus();
  });

  test("the default shell accepts a named group and caller layout styles", () => {
    render(<HeaderShell role="group" aria-label="Page controls" width="full" top={32}
      style={{ position: "relative", top: 0 }} left="Page controls" />);
    expect(screen.getByRole("group", { name: "Page controls" })).toHaveStyle({ position: "relative", top: "0px" });
  });

  test("surfaces preserve semantic roles, refs, and native button behavior", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const action = vi.fn();
    render(<Surface ref={ref} role="region" aria-label="Project" variant="glass">
      <h2>Project details</h2>
      <GlassPopoverSurface as="button" type="button" onClick={action}>Open project</GlassPopoverSurface>
    </Surface>);
    expect(ref.current).toBe(screen.getByRole("region", { name: "Project" }));
    await user.tab();
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledOnce();
  });

  test("decorative skeletons do not announce placeholder content", () => {
    render(<div role="status" aria-label="Loading profile"><Skeleton>Placeholder</Skeleton></div>);
    expect(screen.getByRole("status", { name: "Loading profile" })).toBeInTheDocument();
    expect(screen.getByText("Placeholder")).toHaveAttribute("aria-hidden", "true");
  });
});
