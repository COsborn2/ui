import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (pkg.license === "UNLICENSED" || !pkg.license) {
  throw new Error("Choose the public package license and add LICENSE before publishing @cosborn2/ui.");
}
await access(resolve(root, "LICENSE"));
if (pkg.publishConfig?.access !== "public") throw new Error("@cosborn2/ui must be published publicly.");
for (const dependency of Object.values(pkg.dependencies ?? {})) {
  if (String(dependency).startsWith("workspace:")) throw new Error("Published dependencies must not reference private workspaces.");
}
console.log("Release metadata verified. Run the packed-package and browser checks before publishing.");

