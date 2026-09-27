import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const out = resolve(root, "dist/styles");
await mkdir(out, { recursive: true });
const tokens = JSON.parse(await readFile(resolve(root, "tokens.json"), "utf8"));
function declarations(values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => `  --bnh-${key}: ${value};`).join("\n");
}
// Theme regions override palette and derived colors, while fonts, radii, and
// application layout offsets continue inheriting from their surrounding scope.
const paletteNames = new Set(Object.keys(tokens.light));
const defaults: Record<string, string> = { ...tokens.shared };
const dark: Record<string, string> = {};
for (const [name, value] of Object.entries(tokens.dark) as [string, string][]) {
  if (paletteNames.has(name) || value.includes("var(--bnh-")) dark[name] = value;
  else defaults[name] = value;
}
const light = { ...dark, ...tokens.light };
const theme = `/* Generated from tokens.json. No reset, font downloads, or runtime provider. */
@layer theme, base, components, utilities;
@layer theme {
:root {
${declarations(defaults)}
}
:root, .bnh-theme-dark, [data-bnh-theme="dark"] {
${declarations(dark)}
}
:root.light, .bnh-theme-light, [data-bnh-theme="light"] {
${declarations(light)}
}
}\n`;
await writeFile(resolve(out, "theme.css"), theme);
const styles = (await readdir(resolve(root, "styles"))).filter((name) => name.endsWith(".css")).sort();
for (const name of styles) {
  await writeFile(resolve(out, name), await readFile(resolve(root, "styles", name)));
}
await writeFile(resolve(out, "all.css"), ["theme.css", ...styles].map((name) => `@import "./${name}";`).join("\n") + "\n");
await writeFile(resolve(root, "dist/tokens.json"), JSON.stringify({ shared: tokens.shared, dark: tokens.dark, light: { ...tokens.dark, ...tokens.light } }, null, 2) + "\n");
