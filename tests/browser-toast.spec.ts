import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page, url: string) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await expect(page.getByTestId("fixture")).toHaveAttribute("data-hydrated", "true");
  return errors;
}

for (const [name, url] of [
  ["plain React", process.env.BNH_UI_PLAIN_ORIGIN!],
  ["production Next", `${process.env.BNH_UI_NEXT_ORIGIN!}/interactive`],
]) {
  test(`${name} announces toast messages and keeps actions outside live regions`, async ({ page }) => {
    await page.clock.install();
    const errors = await ready(page, url);
    const fixture = page.getByTestId("toast-examples");
    const polite = fixture.locator('.bnh-toast-announcer[aria-live="polite"]');
    const assertive = fixture.locator('.bnh-toast-announcer[aria-live="assertive"]');
    await expect(polite).toBeEmpty();
    await expect(assertive).toBeEmpty();
    await polite.evaluate((element) => { element.setAttribute("data-original-region", "true"); });
    await fixture.getByRole("button", { name: "Show actionable toast", exact: true }).click();
    const viewport = fixture.getByRole("region", { name: "Example notifications" });
    await expect(polite).toHaveAttribute("data-original-region", "true");
    await expect(polite).toHaveText("Board archived.");
    await expect(polite).not.toContainText("Undo");
    await expect(polite).not.toContainText("Dismiss");
    await expect(viewport.locator(".bnh-toast__message")).toHaveAttribute("aria-live", "off");
    await viewport.getByRole("button", { name: "Undo archive", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(fixture.getByTestId("toast-actions")).toHaveText("1");
    await expect(viewport.locator(".bnh-toast")).toHaveCount(0);
    await expect(fixture.getByTestId("toast-submissions")).toHaveText("0");

    await fixture.getByRole("button", { name: "Show persistent error", exact: true }).click();
    await expect(assertive).toContainText("Could not save the changes.");
    await expect(assertive).toHaveAttribute("aria-relevant", "additions text");
    await expect(assertive).toHaveAttribute("aria-atomic", "false");
    await page.clock.fastForward(60_000);
    await expect(viewport.locator(".bnh-toast")).toHaveCount(1);
    await expect(viewport.locator(".bnh-toast__ring-progress")).toHaveCount(0);
    await viewport.getByRole("button", { name: /Dismiss notification/ }).focus();
    await page.keyboard.press("Enter");
    await expect(viewport.locator(".bnh-toast")).toHaveCount(0);
    await expect(fixture.getByTestId("toast-submissions")).toHaveText("0");
    expect(errors).toEqual([]);
  });

  test(`${name} lets a controlled toast host pause for hover and keyboard focus`, async ({ page }) => {
    await page.clock.install();
    const errors = await ready(page, url);
    const fixture = page.getByTestId("toast-examples");
    await fixture.getByRole("button", { name: "Show actionable toast", exact: true }).click();
    const toast = fixture.locator(".bnh-toast");
    const live = fixture.locator('.bnh-toast-announcer[aria-live="polite"]');
    await live.evaluate((element) => {
      Reflect.set(window, "toastAnnouncementMutations", 0);
      new MutationObserver((records) => {
        Reflect.set(window, "toastAnnouncementMutations", Reflect.get(window, "toastAnnouncementMutations") + records.length);
      }).observe(element, { childList: true, characterData: true, subtree: true, attributes: true });
    });
    await page.clock.fastForward(300);
    const elapsed = Number(await toast.getAttribute("data-remaining"));
    expect(elapsed).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1500);
    expect(await page.evaluate(() => Reflect.get(window, "toastAnnouncementMutations"))).toBe(0);

    await toast.hover();
    const paused = await toast.getAttribute("data-remaining");
    await page.clock.fastForward(5000);
    await expect(toast).toHaveAttribute("data-remaining", paused!);
    await toast.getByRole("button", { name: "Undo archive", exact: true }).focus();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(5000);
    await expect(toast).toHaveAttribute("data-remaining", paused!);
    await toast.getByRole("button", { name: /Dismiss notification/ }).focus();
    await page.clock.fastForward(5000);
    await expect(toast).toHaveAttribute("data-remaining", paused!);
    expect(await page.evaluate(() => Reflect.get(window, "toastAnnouncementMutations"))).toBe(0);

    await fixture.getByRole("button", { name: "Clear toast examples", exact: true }).focus();
    await page.clock.fastForward(1600);
    await expect(toast).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test(`${name} bounds long toast stacks and preserves focused controls on small screens`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 500 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = await ready(page, url);
    const fixture = page.getByTestId("toast-examples");
    await fixture.getByRole("button", { name: "Show long toast stack", exact: true }).click();
    const viewport = fixture.getByTestId("toast-viewport");
    for (const theme of ["dark", "light"]) {
      await page.evaluate((value) => { document.documentElement.dataset.bnhTheme = value; }, theme);
      const bounds = await viewport.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(12);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(500);
      expect(await viewport.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      const toasts = viewport.locator(".bnh-toast");
      await expect(toasts.last()).toHaveCSS("animation-name", "none");
      const count = await toasts.count();
      const dismiss = toasts.last().getByRole("button", { name: /Dismiss notification/ });
      await dismiss.focus();
      await expect(dismiss).toBeFocused();
      const control = await dismiss.boundingBox();
      expect(control!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(control!.y + control!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
      await viewport.screenshot({ path: testInfo.outputPath(`toast-stack-${theme}-320.png`), animations: "disabled" });
      await page.keyboard.press("Enter");
      await expect(toasts).toHaveCount(count - 1);
    }
    expect(errors).toEqual([]);
  });
}
