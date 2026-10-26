import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const result = spawnSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], { cwd: root, encoding: "utf8" });
if (result.status !== 0) throw new Error(result.stderr || "npm pack failed");
const [pack] = JSON.parse(result.stdout) as Array<{ name: string; version: string; files: Array<{ path: string }> }>;
assert.equal(pack.name, manifest.name);
assert.equal(pack.version, manifest.version);
const files = new Set(pack.files.map(file => file.path));
for (const name of ["README.md", "LICENSE", "package.json"]) assert.ok(files.has(name), `Missing ${name}`);
for (const file of files) {
  assert.ok(file.startsWith("dist/") || ["README.md", "LICENSE", "package.json"].includes(file), `Unexpected published file: ${file}`);
  assert.ok(!/\.(?:stories|test|spec)\.[cm]?[jt]sx?$/.test(file), `Development file in package: ${file}`);
}
function checkExport(value: unknown): void {
  if (typeof value === "string") {
    assert.ok(value.startsWith("./"), `Non-relative export: ${value}`);
    assert.ok(files.has(value.slice(2)), `Missing published export: ${value}`);
  } else if (value && typeof value === "object") {
    for (const destination of Object.values(value)) checkExport(destination);
  }
}
checkExport(manifest.exports);
console.log(`Package exports and contents verified (${files.size} files).`);
