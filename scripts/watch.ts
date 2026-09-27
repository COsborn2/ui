import { watch } from "node:fs";
import { resolve } from "node:path";

const cwd = resolve(import.meta.dir, "..");
const initial = Bun.spawn(["bun", "run", "build"], { cwd, stdout: "inherit", stderr: "inherit" });
if (await initial.exited) process.exit(1);
const compiler = Bun.spawn(["tsc", "-p", "tsconfig.json", "--watch", "--preserveWatchOutput"], { cwd, stdout: "inherit", stderr: "inherit" });
let pending: ReturnType<typeof setTimeout>;
function updateStyles() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    Bun.spawn(["bun", "scripts/build-css.ts"], { cwd, stdout: "inherit", stderr: "inherit" });
  }, 80);
}
const watchers = [watch(resolve(cwd, "styles"), { recursive: true }, updateStyles), watch(resolve(cwd, "tokens.json"), updateStyles)];
process.on("SIGINT", () => { watchers.forEach((watcher) => watcher.close()); compiler.kill(); process.exit(); });
await compiler.exited;

