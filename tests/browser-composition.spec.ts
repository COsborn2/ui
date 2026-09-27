import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, url: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await expect(page.getByTestId("composition-fixture")).toHaveAttribute("data-hydrated", "true");
  return errors;
}

for (const [name, url] of [
  ["plain React", process.env.BNH_UI_PLAIN_ORIGIN!],
  ["production Next", `${process.env.BNH_UI_NEXT_ORIGIN!}/interactive`],
]) {
  test(`${name} composes native links, header attributes, events and refs`, async ({ page }) => {
    const errors = await ready(page, url);
    const link = page.getByRole("link", { name: "Button-style link" });
    await expect(link).toHaveCSS("text-decoration-line", "none");
    await expect(link).toHaveCSS("height", "40px");
    await link.click();
    await expect(page).toHaveURL(/#composition-target$/);
    const header = page.getByRole("region", { name: "Composition header" });
    await expect(header).toHaveAttribute("data-tour", "composition-header");
    await header.getByRole("button", { name: "Header action" }).click();
    await expect(page.getByTestId("header-clicks")).toHaveText("1");
    await page.getByRole("button", { name: "Inspect header refs" }).click();
    await expect(page.getByTestId("header-ref-targets")).toHaveText("HEADER/DIV");
    expect(errors).toEqual([]);
  });

  test(`${name} closes a disclosure from panel focus and restores its trigger`, async ({ page }) => {
    const errors = await ready(page, url);
    const trigger = page.getByRole("button", { name: "Composition details", exact: true });
    await trigger.click();
    await page.getByRole("textbox", { name: "Panel field", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("textbox", { name: "Panel field", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} lets nested controls own Escape without closing their disclosure`, async ({ page }) => {
    const errors = await ready(page, url);
    const trigger = page.getByRole("button", { name: "Composition details", exact: true });
    await trigger.click();
    const field = page.getByRole("textbox", { name: "Escape-owning field" });
    await field.focus();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("consumed-escapes")).toHaveText("1");
    await expect(field).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const nested = page.getByRole("button", { name: "Nested disclosure", exact: true });
    await nested.click();
    await page.getByRole("textbox", { name: "Nested panel field" }).focus();
    await page.keyboard.press("Escape");
    await expect(nested).toHaveAttribute("aria-expanded", "false");
    await expect(nested).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Open portaled control" }).click();
    await page.getByRole("textbox", { name: "Portaled field" }).focus();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("textbox", { name: "Portaled field" })).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await trigger.focus();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(errors).toEqual([]);
  });
}
