import { expect, test } from "@playwright/test";

test("plain React notices retain component styling without Tailwind", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BNH_UI_PLAIN_ORIGIN!);
  const notice = page.locator(".bnh-notice").filter({ hasText: "Plain React notice without Tailwind" });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveCSS("display", "flex");
  await expect(notice).toHaveCSS("padding", "12px");
  await expect(notice).toHaveCSS("border-top-style", "solid");
  await expect(notice).toHaveCSS("font-size", "14px");
  expect(await notice.getAttribute("role")).toBeNull();
  expect(errors).toEqual([]);
});

test("server notices and toast presentation stay visible without JavaScript in both themes", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 320, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`${process.env.BNH_UI_NEXT_ORIGIN!}/data`);
    const notice = page.locator(".bnh-notice").filter({ hasText: "Server notice rendered without hydration" });
    const toast = page.locator(".bnh-toast").filter({ hasText: "Server toast presentation" });
    await expect(notice).toBeVisible();
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("status")).toHaveText("Server toast presentation");
    await expect(toast.getByRole("button")).toHaveCount(0);
    expect(await notice.getAttribute("role")).toBeNull();

    const colors: string[][] = [];
    for (const theme of ["dark", "light"]) {
      // Change only the theme attribute; application JavaScript remains disabled.
      await page.evaluate((value) => { document.documentElement.dataset.bnhTheme = value; }, theme);
      colors.push(await Promise.all([notice, toast].map((component) => component.evaluate((node) => getComputedStyle(node).color))));
      for (const component of [notice, toast]) {
        await expect(component).toBeVisible();
        const box = await component.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(321);
        expect(await component.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      }
    }
    expect(colors[0]![0]).not.toBe(colors[1]![0]);
    expect(colors[0]![1]).not.toBe(colors[1]![1]);
    await expect(toast).toHaveCSS("animation-name", "none");
  } finally {
    await context.close();
  }
});
