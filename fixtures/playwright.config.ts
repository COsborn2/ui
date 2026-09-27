import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: resolve(import.meta.dirname, "../tests"),
  testMatch: "browser*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  outputDir: process.env.BNH_UI_BROWSER_OUTPUT,
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: { executablePath: process.env.BNH_UI_CHROMIUM_EXECUTABLE },
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
  },
});
