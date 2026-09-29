import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPicker } from "../src/color-picker.js";
import { ThemeToggle, type ThemePreference } from "../src/theme-toggle.js";

const colors = [{ value: "#123456", label: "Ocean" }, { value: "#654321", label: "Earth", disabled: true }];

describe("controlled preferences", () => {
  test("theme selection updates through the parent with keyboard input and never submits", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event) => event.preventDefault());
    const changed = vi.fn();
    function Preferences() {
      const [theme, setTheme] = useState<ThemePreference>("light");
      return <form onSubmit={submit}><ThemeToggle value={theme} onChange={(value) => { changed(value); setTheme(value); }} /></form>;
    }
    render(<Preferences />);
    const group = screen.getByRole("group", { name: "Theme" });
    expect(within(group).getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    await user.tab();
    await user.keyboard("{Enter}");
    expect(changed).toHaveBeenCalledWith("system");
    expect(within(group).getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(changed).toHaveBeenLastCalledWith("dark");
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "false");
    expect(submit).not.toHaveBeenCalled();
  });

  test("a controlled theme waits for the caller to apply a requested preference", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const { rerender } = render(<ThemeToggle value="light" onChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(changed).toHaveBeenCalledWith("dark");
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    rerender(<ThemeToggle value="dark" onChange={changed} />);
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
  });

  test("the caller palette supports selecting and clearing a color while disabled choices stay inert", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    function Palette() {
      const [color, setColor] = useState<string | null>(null);
      return <ColorPicker value={color} onChange={(value) => { changed(value); setColor(value); }} colors={colors} noneLabel="No accent" />;
    }
    render(<Palette />);
    expect(screen.getByRole("button", { name: "No accent" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Ocean" }));
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Earth" }));
    expect(changed).toHaveBeenCalledExactlyOnceWith("#123456");
    await user.click(screen.getByRole("button", { name: "No accent" }));
    expect(changed).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: "Ocean" })).toHaveAttribute("aria-pressed", "false");
  });

  test("disabled groups preserve caller labels and omit the empty choice when requested", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<><ColorPicker value="#123456" onChange={changed} colors={colors} allowNone={false} disabled />
      <ThemeToggle value="system" onChange={changed} disabled labels={{ system: "Automatic" }} /></>);
    expect(screen.queryByRole("button", { name: "None" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automatic" })).toHaveAttribute("aria-pressed", "true");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(changed).not.toHaveBeenCalled();
  });
});
