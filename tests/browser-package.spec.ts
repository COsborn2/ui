import { test, expect, type Page } from "@playwright/test";

const plain = process.env.BNH_UI_PLAIN_ORIGIN!;
const next = process.env.BNH_UI_NEXT_ORIGIN!;

async function ready(page: Page, url: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await expect(page.getByTestId("fixture")).toHaveAttribute("data-hydrated", "true");
  return errors;
}

test("plain React uses the component CSS without Tailwind and traps/restores focus", async ({ page }) => {
  const errors = await ready(page, plain);
  const trigger = page.getByRole("button", { name: "Open parent", exact: true });
  // CSS blockifies inline-flex children of a flex container to flex.
  expect(await trigger.evaluate((node) => getComputedStyle(node).display)).toMatch(/^(?:inline-)?flex$/);
  expect(await trigger.evaluate((node) => getComputedStyle(node).height)).toBe("40px");
  const originalOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Parent dialog", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("tabindex", "-1");
  await expect(dialog.getByRole("heading", { name: "Parent dialog", exact: true })).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription("Focus stays within the active dialog.");
  await expect.poll(() => dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  for (const direction of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(direction);
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(originalOverflow);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.mouse.click(5, 5);
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("Escape closes only the top nested dialog", async ({ page }) => {
  const errors = await ready(page, plain);
  for (let iteration = 0; iteration < 5; iteration++) {
    await page.getByRole("button", { name: "Open parent", exact: true }).click();
    await page.getByRole("button", { name: "Open nested", exact: true }).click();
    const nested = page.getByRole("dialog", { name: "Nested dialog", exact: true });
    await expect(nested).toBeVisible();
    await expect(nested).toHaveCSS("opacity", "1");
    await expect.poll(() => nested.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Nested dialog", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Parent dialog", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open nested", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

for (const [name, origin, path] of [["plain React", plain, "/"], ["production Next", next, "/interactive"]]) {
  test(`${name} preserves focus handed to a new dialog while the old dialog closes`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open handoff dialog", exact: true }).click();
    await page.getByRole("button", { name: "Continue to second dialog", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "First handoff dialog", exact: true })).toHaveCount(0);
    const dialog = page.getByRole("dialog", { name: "Second handoff dialog", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("opacity", "1");
    await expect(page.getByRole("textbox", { name: "Second dialog field", exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`${name} requires all confirmation prerequisites and keeps verification persistent`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open guarded confirmation", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Verify deletion", exact: true });
    const confirm = dialog.getByRole("button", { name: "Verify and delete", exact: true });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("DELETE");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Verification password").fill("verification-example");
    await expect(confirm).toBeEnabled();
    await dialog.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("delete");
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Type DELETE to confirm" }).fill("DELETE");
    await confirm.click();
    await expect(dialog.getByRole("button", { name: "Loading...", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Complete verification", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} routes immediate Escape to the opening nested dialog`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    const parentTrigger = page.getByRole("button", { name: "Open parent", exact: true });
    await parentTrigger.click();
    const parent = page.getByRole("dialog", { name: "Parent dialog", exact: true });
    const rapidTrigger = page.getByRole("button", { name: "Open nested with immediate Escape", exact: true });
    for (let iteration = 1; iteration <= 5; iteration++) {
      await rapidTrigger.click();
      await expect(parent).toBeVisible();
      await expect(page.getByTestId("rapid-escapes")).toHaveText(String(iteration));
      await expect(page.getByRole("dialog", { name: "Nested dialog", exact: true })).toHaveCount(0);
      await expect(parent).toBeVisible();
      await expect(rapidTrigger).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(parent).toHaveCount(0);
    await expect(parentTrigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`${name} protects a persistent nested dialog from immediate Escape`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open parent", exact: true }).click();
    const rapidTrigger = page.getByRole("button", { name: "Open persistent nested with immediate Escape", exact: true });
    await rapidTrigger.click();
    const nested = page.getByRole("dialog", { name: "Nested dialog", exact: true });
    await expect(nested).toBeVisible();
    await expect(page.getByTestId("rapid-escapes")).toHaveText("1");
    await page.keyboard.press("Escape");
    await expect(nested).toBeVisible();
    await page.getByRole("button", { name: "Finish nested", exact: true }).click();
    await expect(nested).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Parent dialog", exact: true })).toBeVisible();
    await expect(rapidTrigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} routes immediate Escape during a conditional explicit-container mount`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open parent", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Mount nested with immediate Escape", exact: true });
    for (let iteration = 1; iteration <= 3; iteration++) {
      await trigger.click();
      await expect(page.getByRole("dialog", { name: "Parent dialog", exact: true })).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Conditional nested dialog", exact: true })).toHaveCount(0);
      await expect(page.getByTestId("rapid-escapes")).toHaveText(String(iteration));
      await expect(trigger).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} handles immediate Escape before the first Radix listener`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    const trigger = page.getByRole("button", { name: "Mount immediate dialog", exact: true });
    for (let iteration = 1; iteration <= 3; iteration++) {
      await trigger.click();
      await expect(page.getByTestId("all-rapid-escapes")).toHaveText(String(iteration));
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    expect(errors).toEqual([]);
  });

  test(`${name} orders simultaneously mounted dialogs before immediate Escape`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    const trigger = page.getByRole("button", { name: "Mount both dialogs with immediate Escape", exact: true });
    await trigger.click();
    const parent = page.getByRole("dialog", { name: "Simultaneous parent", exact: true });
    await expect(parent).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Simultaneous child", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("all-rapid-escapes")).toHaveText("1");
    await expect.poll(() => parent.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`${name} leaves Escape ownership with nested Radix dialogs`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open parent", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Open Radix child", exact: true });
    await trigger.click();
    const child = page.getByRole("dialog", { name: "Radix child dialog", exact: true });
    await expect(child).toBeVisible();
    await expect(child).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(child).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Parent dialog", exact: true })).toBeVisible();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("confirmation clears typed state between openings", async ({ page }) => {
  const errors = await ready(page, plain);
  const trigger = page.getByRole("button", { name: "Open confirmation" });
  await trigger.click();
  const input = page.getByRole("textbox", { name: "Type DELETE to confirm" });
  const confirm = page.getByRole("button", { name: "Delete item", exact: true });
  await expect(confirm).toBeDisabled();
  await input.fill("DELETE");
  await expect(confirm).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue("");
  await expect(confirm).toBeDisabled();
  await input.fill("DELETE");
  await confirm.click();
  await expect(page.getByTestId("confirmed-count")).toHaveText("1");
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test("persistent dialogs reject Escape and backdrop dismissal", async ({ page }) => {
  const errors = await ready(page, plain);
  await page.getByRole("button", { name: "Open persistent" }).click();
  const dialog = page.getByRole("dialog", { name: "Persistent dialog" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Finish persistent" }).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("portals preserve explicit, container and inherited scoped themes", async ({ page }) => {
  const errors = await ready(page, plain);
  const lightText = await page.getByTestId("scoped-theme").evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-text").trim());
  await page.getByRole("button", { name: "Open light dialog" }).click();
  const light = page.getByRole("dialog", { name: "Light dialog", exact: true });
  await expect.poll(() => light.evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-text").trim())).toBe(lightText);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open scoped dialog" }).click();
  const scoped = page.getByRole("dialog", { name: "Scoped dialog", exact: true });
  await expect(page.getByTestId("scoped-portal").getByRole("dialog")).toBeVisible();
  await expect.poll(() => scoped.evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-accent").trim())).toBe("rgb(12, 34, 56)");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open inherited dialog" }).click();
  const inherited = page.getByRole("dialog", { name: "Inherited dialog", exact: true });
  await expect.poll(() => inherited.evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-accent").trim())).toBe("rgb(65, 43, 21)");
  expect(await inherited.evaluate((node) => node.closest('[data-testid="inherited-theme"]'))).toBeNull();
  await page.getByTestId("inherited-theme").evaluate((node) => (node as HTMLElement).style.setProperty("--bnh-accent", "rgb(11, 22, 33)"));
  await expect.poll(() => inherited.evaluate((node) => getComputedStyle(node).getPropertyValue("--bnh-accent").trim())).toBe("rgb(11, 22, 33)");
  expect(errors).toEqual([]);
});

for (const [name, origin, path] of [["plain React", plain, "/initial-open"], ["production Next", next, "/initial-open"]]) {
  test(`${name} hydrates initially open portals without mismatch`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await expect(page.getByRole("dialog", { name: "Parent dialog", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("production Next accepts server-produced dialog children", async ({ page }) => {
  const errors = await ready(page, next + "/interactive");
  await page.getByRole("button", { name: "Open parent", exact: true }).click();
  await expect(page.getByTestId("server-child")).toHaveText("Computed on the server");
  expect(errors).toEqual([]);
});

for (const [name, origin, path] of [["plain React", plain, "/"], ["production Next", next, "/interactive"]]) {
  test(`${name} preserves standard backdrop filters after CSS compilation`, async ({ page }) => {
    const errors = await ready(page, origin + path);
    await page.getByRole("button", { name: "Open parent", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Parent dialog", exact: true });
    const backdrop = page.locator(".bnh-modal-backdrop");
    await expect(dialog).toHaveCSS("opacity", "1");
    await expect(backdrop).toBeVisible();
    // Chromium ignores the WebKit-only declaration. These assertions protect
    // the unprefixed property through consumer CSS optimizers, not just source text.
    await expect(dialog).toHaveCSS("backdrop-filter", /blur\(32px\)/);
    await expect(backdrop).toHaveCSS("backdrop-filter", /blur\(20px\)/);
    expect(errors).toEqual([]);
  });
}

test("settings content and native forms work with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(next);
  await expect(page.getByRole("heading", { name: "Server settings fixture" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue("Server profile");
  await expect(page.getByRole("button", { name: "Server save" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Server save" }).click();
  await expect(page.getByRole("heading", { name: "Server settings fixture" })).toBeVisible();
  await context.close();
});

test("capture shared settings and modal layouts in both themes and sizes", async ({ page }, testInfo) => {
  for (const [size, width, height] of [["desktop", 1280, 900], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    for (const theme of ["dark", "light"] as const) {
      await page.goto(next);
      await page.evaluate((theme) => { document.documentElement.dataset.bnhTheme = theme; }, theme);
      await expect(page.getByRole("heading", { name: "Server settings fixture" })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`settings-${theme}-${size}.png`), fullPage: true, animations: "disabled" });
      await ready(page, plain);
      await page.evaluate((theme) => { document.documentElement.dataset.bnhTheme = theme; }, theme);
      await page.getByRole("button", { name: "Open parent", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Parent dialog", exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toBeInViewport();
      await expect(dialog).toHaveCSS("opacity", "1");
      await expect(dialog.getByRole("textbox", { name: "Parent name" })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`modal-${theme}-${size}.png`), fullPage: false, animations: "disabled" });
    }
  }
});
