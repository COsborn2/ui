import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPicker } from "../src/color-picker.js";
import { ExpandablePill } from "../src/expandable-pill.js";
import { HeaderShell } from "../src/header-shell.js";
import { Pill } from "../src/pill.js";
import { Select } from "../src/select.js";
import { SettingsSection } from "../src/settings.js";

// Per-instance values arrive as custom properties; the stylesheets own the
// declarations, so an application stylesheet can still restyle the property.
describe("stylesheet-owned presentation", () => {
  test("Pill passes tint, border, and height as custom properties instead of inline declarations", () => {
    render(<Pill tint="red" height={30}>Beta</Pill>);
    const pill = screen.getByText("Beta");
    expect(pill.style.getPropertyValue("--bnh-pill-background")).toBe("color-mix(in oklch, red 8%, transparent)");
    expect(pill.style.getPropertyValue("--bnh-pill-border-color")).toBe("color-mix(in oklch, red 30%, transparent)");
    expect(pill.style.getPropertyValue("--bnh-pill-height")).toBe("30px");
    expect(pill.style.border).toBe("");
    expect(pill.style.background).toBe("");
    expect(pill.style.height).toBe("");
  });

  test("explicit pill colors win over the tint and caller styles still apply last", () => {
    render(<Pill tint="red" background="white" borderColor="black" style={{ color: "blue" }}>Plain</Pill>);
    const pill = screen.getByText("Plain");
    expect(pill.style.getPropertyValue("--bnh-pill-background")).toBe("white");
    expect(pill.style.getPropertyValue("--bnh-pill-border-color")).toBe("black");
    expect(pill.style.getPropertyValue("--bnh-pill-height")).toBe("");
    expect(pill).toHaveStyle({ color: "rgb(0, 0, 255)" });
  });

  test("ExpandablePill exposes its panel state as attributes rather than inline animation styles", async () => {
    const user = userEvent.setup();
    render(<ExpandablePill tint="green" panelGap={10} panelMaxWidth={280} panel={<p>Details</p>}>Status</ExpandablePill>);
    const trigger = screen.getByRole("button", { name: "Status" });
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(trigger.style.border).toBe("");
    expect(trigger.style.getPropertyValue("--bnh-pill-border-color")).toBe("color-mix(in oklch, green 30%, transparent)");
    expect(panel).toHaveAttribute("data-state", "closed");
    expect(panel.style.getPropertyValue("--bnh-expandable-pill-gap")).toBe("10px");
    expect(panel.style.getPropertyValue("--bnh-expandable-pill-panel-max-width")).toBe("280px");
    expect(panel.style.opacity).toBe("");
    expect(panel.style.transform).toBe("");
    await user.click(trigger);
    expect(panel).toHaveAttribute("data-state", "open");
  });

  test("HeaderShell layout props become custom properties for header-shell.css", () => {
    render(<HeaderShell role="group" aria-label="Toolbar" width="full" top={32} zIndex={50} gap={4} sideMargin={12} maxWidth={960} left="Toolbar" />);
    const shell = screen.getByRole("group", { name: "Toolbar" });
    expect(shell).toHaveClass("bnh-header-shell", "bnh-header-shell--full");
    expect(shell.style.getPropertyValue("--bnh-header-shell-top")).toBe("32px");
    expect(shell.style.getPropertyValue("--bnh-header-shell-z")).toBe("50");
    expect(shell.style.getPropertyValue("--bnh-header-shell-gap")).toBe("4px");
    expect(shell.style.getPropertyValue("--bnh-header-shell-side-margin")).toBe("12px");
    expect(shell.style.getPropertyValue("--bnh-header-shell-max-width")).toBe("960px");
    expect(shell.style.position).toBe("");
    expect(shell.style.padding).toBe("");
  });

  test("an unconfigured HeaderShell leaves every layout default to the stylesheet", () => {
    render(<HeaderShell role="group" aria-label="Defaults" left="Defaults" />);
    const shell = screen.getByRole("group", { name: "Defaults" });
    expect(shell).not.toHaveClass("bnh-header-shell--full");
    expect(shell.getAttribute("style")).toBeNull();
  });

  test("Select draws a decorative chevron that follows text color and stays out of the accessible name", () => {
    render(<Select label="Team" defaultValue="Design"><option>Design</option><option>Research</option></Select>);
    const select = screen.getByRole("combobox", { name: "Team" });
    const icon = select.nextElementSibling;
    expect(icon?.tagName.toLowerCase()).toBe("svg");
    expect(icon).toHaveClass("bnh-select-icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(select.style.backgroundImage).toBe("");
  });

  test("ColorPicker swatches carry their color as a custom property", () => {
    render(<ColorPicker value={null} onChange={() => {}} allowNone={false} colors={[{ value: "rgb(255, 0, 0)", label: "Red" }]} />);
    const swatch = screen.getByRole("button", { name: "Red" });
    expect(swatch.style.getPropertyValue("--bnh-color-picker-swatch")).toBe("rgb(255, 0, 0)");
    expect(swatch.style.backgroundColor).toBe("");
  });

  test("SettingsSection staggers its entrance through a custom property", () => {
    render(<SettingsSection aria-label="Second" title="Second" index={2}>Body</SettingsSection>);
    const section = screen.getByRole("region", { name: "Second" });
    expect(section.style.getPropertyValue("--bnh-settings-enter-delay")).toBe("160ms");
    expect(section.style.animationDelay).toBe("");
  });
});
