import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { packageRoot, prepareFixture, removeFixture, run, saveReport, startNext, startPlain, verifyNextResponses, type Fixture, type RunningServer } from "./verify-package.js";

const playwrightArguments: string[] = [];
const argumentsToParse = process.argv.slice(2);
for (let index = 0; index < argumentsToParse.length; index++) {
  const argument = argumentsToParse[index];
  if (argument === "--keep") {
    process.env.BNH_UI_KEEP_FIXTURE = "1";
  } else if (argument === "--fixture-dir" || argument === "--chromium") {
    const value = argumentsToParse[++index];
    if (!value) throw new Error(`${argument} requires a path`);
    process.env[argument === "--fixture-dir" ? "BNH_UI_FIXTURE_DIR" : "BNH_UI_CHROMIUM_EXECUTABLE"] = value;
  } else {
    playwrightArguments.push(argument);
  }
}

let fixture: Fixture | undefined;
let next: RunningServer | undefined;
let plain: RunningServer | undefined;
let passed = false;
try {
  fixture = await prepareFixture();
  next = await startNext(fixture);
  plain = await startPlain(fixture);
  await verifyNextResponses(fixture, next.origin);
  const output = join(fixture.artifacts, "browser");
  await mkdir(output, { recursive: true });
  const require = createRequire(join(packageRoot, "package.json"));
  const cli = join(dirname(require.resolve("@playwright/test/package.json")), "cli.js");
  console.log("Running browser hydration, focus, theme and responsive checks...");
  const result = await run("node", [cli, "test", "--config", "fixtures/playwright.config.ts", ...playwrightArguments], packageRoot, {
    BNH_UI_NEXT_ORIGIN: next.origin,
    BNH_UI_PLAIN_ORIGIN: plain.origin,
    BNH_UI_BROWSER_OUTPUT: output,
  });
  console.log(result.stdout);
  if (result.stderr.trim()) console.log(result.stderr);
  fixture.report.browser = { passed: true, executable: process.env.BNH_UI_CHROMIUM_EXECUTABLE ?? "Playwright-managed Chromium", screenshotDirectory: output, cases: "Focus containment/restoration, immediate opening/nested Escape and persistent dialogs, Radix child interoperability, confirmation reset, scoped theme inheritance/overrides, initial-open hydration, RSC children, no-JS settings/table/pagination/notice/toast, accessible action menus with nested Escape and dialog focus handoff, controlled toast actions/live regions/timer pauses and bounded stacks, controlled preferences, keyboard table activation, link styles, disclosure Escape and nested controls, header attributes/refs, computed backdrop filters, dark/light desktop/mobile captures" };
  await saveReport(fixture);
  console.log(`Browser screenshots: ${output}`);
  passed = true;
} finally {
  await Promise.allSettled([plain?.stop(), next?.stop()]);
  if (passed && fixture) await removeFixture(fixture);
}
