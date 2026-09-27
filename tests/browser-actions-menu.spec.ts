import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, origin: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(origin);
  await expect(page.getByTestId("actions-menu-fixture")).toHaveAttribute("data-hydrated", "true");
  return errors;
}

for (const [name, origin] of [["plain React", process.env.BNH_UI_PLAIN_ORIGIN!], ["production Next", process.env.BNH_UI_NEXT_ORIGIN! + "/interactive"]]) {
  test(`${name} ActionsMenu supports keyboard selection without activating its row`, async ({ page }) => {
    const errors = await ready(page, origin);
    const trigger = page.getByRole("button", { name: "Record actions", exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Rename record" })).toBeFocused();
    await expect(page.getByRole("menuitem", { name: "Archive record" })).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Delete record" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitem", { name: "Rename record" })).toBeFocused();
    await page.keyboard.type("del");
    await expect(page.getByRole("menuitem", { name: "Delete record" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId("action-menu-selection")).toHaveText("delete");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId("action-menu-row-activations")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Unavailable actions" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Empty actions" })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test(`${name} ActionsMenu handles pointer selection, outside dismissal, and dialog actions`, async ({ page }) => {
    const errors = await ready(page, origin);
    const trigger = page.getByRole("button", { name: "Record actions", exact: true });
    await trigger.click();
    await page.getByRole("menuitem", { name: "Rename record" }).click();
    await expect(page.getByTestId("action-menu-selection")).toHaveText("rename");
    await expect(page.getByTestId("action-menu-row-activations")).toHaveText("0");
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("button", { name: "Custom actions", exact: true }).click();
    await page.getByRole("menuitem", { name: "Open details" }).click();
    const dialog = page.getByRole("dialog", { name: "Action menu dialog" });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} ActionsMenu inherits scoped themes through both portal modes`, async ({ page }) => {
    const errors = await ready(page, origin);
    for (const label of ["Scoped actions", "Container actions"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const menu = page.getByRole("menu");
      await expect(menu).toHaveCSS("background-color", "rgb(245, 240, 230)");
      if (label === "Container actions") await expect(page.getByTestId("actions-menu-portal").getByRole("menu")).toBeVisible();
      await page.getByTestId("actions-theme-region").evaluate((node) => (node as HTMLElement).style.setProperty("--bnh-accent", "rgb(21, 43, 65)"));
      await expect.poll(() => menu.evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-accent").trim())).toBe("rgb(21, 43, 65)");
      await page.keyboard.press("Escape");
    }
    const darkText = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bnh-text").trim());
    await page.getByRole("button", { name: "Dark actions", exact: true }).click();
    await expect.poll(() => page.getByRole("menu").evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-text").trim())).toBe(darkText);
    expect(errors).toEqual([]);
  });

  test(`${name} ActionsMenu requests each outside dismissal only once when controlled`, async ({ page }) => {
    const errors = await ready(page, origin);
    await page.getByRole("button", { name: "Retained actions", exact: true }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(page.getByTestId("action-menu-close-requests")).toHaveText("1");
    await expect(menu).toBeVisible();
    await menu.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Retained action", exact: true })).toBeFocused();
    await page.mouse.click(1, 1);
    await expect(page.getByTestId("action-menu-close-requests")).toHaveText("2");
    await expect(menu).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${name} ActionsMenu keeps the parent Modal open on immediate Escape`, async ({ page }) => {
    const errors = await ready(page, origin);
    await page.getByRole("button", { name: "Open action menu dialog", exact: true }).click();
    const parent = page.getByRole("dialog", { name: "Action menu dialog" });
    const trigger = page.getByRole("button", { name: "Dialog actions", exact: true });
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(parent).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(parent).toBeVisible();
    for (const [index, action] of ["Open menu with immediate Escape", "Mount menu with immediate Escape", "Open menu with immediate Escape"].entries()) {
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(parent).toBeVisible();
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(page.getByTestId("action-menu-rapid-count")).toHaveText(String(index + 1));
      await expect.poll(() => parent.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(parent).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} ActionsMenu stays inside a narrow viewport and scrolls long menus`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const errors = await ready(page, origin);
    const trigger = page.getByRole("button", { name: "Corner actions", exact: true });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect.poll(async () => {
      const bounds = await menu.boundingBox();
      return Boolean(bounds && bounds.x >= 7 && bounds.y >= 7 && bounds.x + bounds.width <= 313 && bounds.y + bounds.height <= 561);
    }).toBe(true);
    await expect.poll(() => menu.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: "Corner action 30", exact: true })).toBeFocused();
    await expect(page.getByRole("menuitem", { name: "Corner action 30", exact: true })).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("action-menu-selection")).toHaveText("corner-30");
    expect(errors).toEqual([]);
  });
}
