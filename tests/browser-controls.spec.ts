import { test, expect } from "@playwright/test";

const plain = process.env.BNH_UI_PLAIN_ORIGIN!;
const next = process.env.BNH_UI_NEXT_ORIGIN!;

for (const [name, url] of [["plain React", plain], ["production Next", `${next}/interactive`]]) {
  test(`${name} controls accept keyboard input without submitting their form`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(url);
    await expect(page.getByTestId("fixture")).toHaveAttribute("data-hydrated", "true");
    const fixture = page.getByTestId("control-examples");
    const light = fixture.getByRole("button", { name: "Light theme", exact: true });
    await light.focus();
    await page.keyboard.press("Space");
    await expect(light).toHaveAttribute("aria-pressed", "true");
    await expect(fixture.getByTestId("theme-value")).toHaveText("light");
    await expect(page.locator("html")).toHaveAttribute("data-bnh-theme", "dark");
    const ocean = fixture.getByRole("button", { name: "Ocean", exact: true });
    await ocean.focus();
    await page.keyboard.press("Enter");
    await expect(ocean).toHaveAttribute("aria-pressed", "true");
    await expect(ocean).toHaveCSS("background-color", "rgb(18, 52, 86)");
    await expect(ocean).toHaveCSS("width", "28px");
    await expect(fixture.getByRole("button", { name: "Earth", exact: true })).toBeDisabled();
    await fixture.getByRole("button", { name: "None", exact: true }).click();
    await expect(fixture.getByTestId("color-value")).toHaveText("none");
    await fixture.getByRole("button", { name: "Next", exact: true }).click();
    await expect(fixture).toContainText("Showing 21-40 of 45 records");
    await fixture.getByRole("button", { name: "Next", exact: true }).click();
    await expect(fixture).toContainText("Showing 41-45 of 45 records");
    await expect(fixture.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await expect(fixture.getByTestId("submit-count")).toHaveText("0");
    const row = fixture.getByRole("row").filter({ hasText: "Second record" });
    await fixture.getByRole("row").filter({ hasText: "First record" }).hover();
    await expect(fixture.getByTestId("intended-record")).toHaveText("First record");
    await expect(fixture.getByTestId("selected-record")).toHaveText("");
    await row.focus();
    await expect(fixture.getByTestId("intended-record")).toHaveText("Second record");
    await page.keyboard.press("Enter");
    await expect(fixture.getByTestId("selected-record")).toHaveText("Second record");
    expect(errors).toEqual([]);
  });
}

test("server-rendered table and pagination links work with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${next}/data`);
    await expect(page.getByRole("table", { name: "Server records" })).toContainText("Server record 1");
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(`${next}/data?page=1`);
    await expect(page.getByRole("table", { name: "Server records" })).toContainText("Server record 2");
    await expect(page.getByRole("link", { name: "Next", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Previous", exact: true }).click();
    await expect(page.getByRole("table", { name: "Server records" })).toContainText("Server record 1");
  } finally {
    await context.close();
  }
});

test("additional controls fit narrow screens in both themes", async ({ page }, testInfo) => {
  await page.goto(plain);
  await expect(page.getByTestId("fixture")).toHaveAttribute("data-hydrated", "true");
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => { document.documentElement.dataset.bnhTheme = value; }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const controls = page.getByTestId("control-examples");
      await expect(controls.getByRole("table")).toBeVisible();
      const bounds = await controls.locator(".bnh-data-table").boundingBox();
      expect(bounds!.width).toBeLessThanOrEqual(width);
      await expect(controls.getByRole("navigation", { name: "Pagination" })).toHaveCSS("flex-direction", width < 600 ? "column" : "row");
      await controls.screenshot({ path: testInfo.outputPath(`controls-${theme}-${width}.png`), animations: "disabled" });
    }
  }
});
