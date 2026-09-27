import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, posix, relative, resolve } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { build, type Metafile } from "esbuild";
import { bundle } from "lightningcss";
import ts from "typescript";

export const packageRoot = resolve(import.meta.dirname, "..");
const packageRequire = createRequire(join(packageRoot, "package.json"));
const reactExternals = ["react", "react/*", "react-dom", "react-dom/*"];

interface PublishedDependencies {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/** Published code may import its own distribution or declared public dependencies. */
export function assertIsolatedImports(content: string, filename: string, manifest: PublishedDependencies) {
  const entries = [...Object.entries(manifest.dependencies ?? {}), ...Object.entries(manifest.peerDependencies ?? {})];
  const dependencies = new Set(entries.map(([name]) => name));
  for (const [name, version] of entries) {
    assert.ok(!/^(?:workspace|file|link|portal|npm):/.test(version), `Nonportable dependency ${name}: ${version}`);
  }
  // TypeScript's scanner covers imports, re-exports, import types, literal
  // dynamic imports and require calls without matching comments or plain text.
  const references = ts.preProcessFile(content, true, true);
  for (const { fileName: specifier } of [...references.importedFiles, ...references.referencedFiles, ...references.typeReferenceDirectives]) {
    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const target = posix.normalize(posix.join(posix.dirname(filename), specifier));
      assert.ok(target.startsWith("dist/") && !specifier.includes("\\"), `Import escapes the published distribution in ${filename}: ${specifier}`);
      continue;
    }
    const name = specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
    assert.ok(name !== "next" && name !== "zustand" && !name.startsWith("@fortawesome/"), `Application runtime dependency in ${filename}: ${specifier}`);
    assert.ok(dependencies.has(name) && !specifier.split("/").includes("..") && !specifier.includes("\\"), `Undeclared dependency in ${filename}: ${specifier}`);
  }
}

export interface Fixture {
  directory: string;
  consumer: string;
  artifacts: string;
  report: Record<string, unknown>;
}

export async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  const child = spawn(command, args, { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (value) => { stdout += value; });
  child.stderr.on("data", (value) => { stderr += value; });
  await new Promise<void>((accept, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? accept() : reject(new Error(`${command} ${args.join(" ")} exited ${code}\n${stdout}\n${stderr}`)));
  });
  return { stdout, stderr };
}

function compressed(bytes: Uint8Array | string) {
  const input = typeof bytes === "string" ? Buffer.from(bytes) : bytes;
  return { minified: input.byteLength, gzip: gzipSync(input, { level: 9 }).byteLength, brotli: brotliCompressSync(input).byteLength };
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? filesBelow(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

function emittedInputs(metafile: Metafile) {
  const emitted = new Set<string>();
  for (const output of Object.values(metafile.outputs)) {
    for (const [name, contribution] of Object.entries(output.inputs)) {
      if (contribution.bytesInOutput > 0) emitted.add(name);
    }
  }
  return [...emitted].sort();
}

async function measureJavaScript(consumer: string, artifacts: string, name: string, source: string) {
  const result = await build({
    stdin: { contents: source, resolveDir: consumer, sourcefile: `${name}.tsx`, loader: "tsx" },
    absWorkingDir: consumer,
    bundle: true,
    write: false,
    minify: true,
    treeShaking: true,
    jsx: "automatic",
    format: "esm",
    platform: "browser",
    target: ["es2022"],
    external: reactExternals,
    metafile: true,
    logLevel: "silent",
  });
  const output = result.outputFiles[0].contents;
  const inputs = emittedInputs(result.metafile);
  await writeFile(join(artifacts, `${name}.min.js`), output);
  await writeFile(join(artifacts, `${name}.graph.json`), JSON.stringify({ inputs, metafile: result.metafile }, null, 2));
  return { ...compressed(output), inputs };
}

async function measureCss(consumer: string, artifacts: string, name: string, entries: string[]) {
  const entry = join(artifacts, `${name}.entry.css`);
  const directory = join(consumer, "node_modules/@cosborn2/ui/dist/styles");
  await writeFile(entry, entries.map((file) => `@import ${JSON.stringify(join(directory, file))};`).join("\n"));
  const result = bundle({ filename: entry, minify: true });
  await writeFile(join(artifacts, `${name}.min.css`), result.code);
  return { ...compressed(result.code), text: result.code.toString() };
}

export async function prepareFixture(): Promise<Fixture> {
  const directory = process.env.BNH_UI_FIXTURE_DIR
    ? await realpath(process.env.BNH_UI_FIXTURE_DIR)
    : await mkdtemp(join(await realpath(tmpdir()), "bnh-ui-verify-"));
  assert.ok(dirname(directory) === await realpath(tmpdir()) && directory.split("/").at(-1)?.startsWith("bnh-ui-verify-"), "Fixture directory must be an owned bnh-ui-verify-* temporary directory");
  const consumer = join(directory, "consumer");
  const artifacts = join(directory, "artifacts");
  await mkdir(artifacts, { recursive: true });
  console.log(`Package fixture: ${directory}`);
  console.log("Building and packing the npm artifact...");
  await run("bun", ["run", "build"], packageRoot);
  const packed = await run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", directory], packageRoot);
  const [pack] = JSON.parse(packed.stdout) as Array<{ filename: string; size: number; unpackedSize: number; files: Array<{ path: string; size: number }> }>;
  const tarball = await readFile(join(directory, pack.filename));
  const digest = createHash("sha256").update(tarball).digest("hex").slice(0, 16);
  const immutableTarball = join(directory, `ui-${digest}.tgz`);
  await writeFile(immutableTarball, tarball);
  await cp(join(packageRoot, "fixtures/consumer"), consumer, { recursive: true });
  // The fixture stack is declared in this package’s devDependencies and locked
  // here; verification never borrows dependencies from an application checkout.
  const installedVersion = (name: string) => packageRequire(`${name}/package.json`).version as string;
  const manifest = {
    name: "bnh-ui-isolated-consumer",
    version: "0.0.0",
    private: true,
    type: "module",
    dependencies: {
      "@cosborn2/ui": `file:${immutableTarball}`,
      next: installedVersion("next"),
      react: installedVersion("react"),
      "react-dom": installedVersion("react-dom"),
      "lucide-react": installedVersion("lucide-react"),
      "@radix-ui/react-dialog": installedVersion("@radix-ui/react-dialog"),
    },
    devDependencies: {
      "@tailwindcss/postcss": installedVersion("@tailwindcss/postcss"),
      tailwindcss: installedVersion("tailwindcss"),
      typescript: installedVersion("typescript"),
      "@types/react": installedVersion("@types/react"),
      "@types/react-dom": installedVersion("@types/react-dom"),
      "@types/node": installedVersion("@types/node"),
    },
  };
  await writeFile(join(consumer, "package.json"), JSON.stringify(manifest, null, 2));
  console.log("Installing the tarball in an isolated consumer (one dependency install)...");
  await run("bun", ["install", "--ignore-scripts", "--no-progress"], consumer);
  const installedPackage = await realpath(join(consumer, "node_modules/@cosborn2/ui"));
  assert.ok(installedPackage.startsWith(consumer + "/"), "UI must resolve inside the isolated consumer, never the source workspace");
  assert.notEqual(installedPackage, await realpath(packageRoot));
  const installedManifest = JSON.parse(await readFile(join(installedPackage, "package.json"), "utf8"));
  assert.deepEqual(installedManifest.sideEffects, ["**/*.css"]);
  assert.ok(installedManifest.peerDependencies.react && installedManifest.peerDependencies["react-dom"]);
  assert.ok(!installedManifest.dependencies.react && !installedManifest.dependencies["react-dom"]);
  for (const file of pack.files.filter((file) => file.path.startsWith("dist/"))) {
    assert.deepEqual(
      await readFile(join(installedPackage, file.path)),
      await readFile(join(packageRoot, file.path)),
      `Installed tarball retained stale content in ${file.path}`,
    );
  }
  for (const entry of Object.values(installedManifest.exports)) {
    for (const destination of typeof entry === "string" ? [entry] : Object.values(entry as Record<string, string>)) {
      assert.ok((await stat(join(installedPackage, destination))).isFile(), `Missing export target ${destination}`);
    }
  }
  const files = await filesBelow(join(installedPackage, "dist"));
  for (const file of files.filter((file) => /\.(?:js|d\.ts)$/.test(file))) {
    const content = await readFile(file, "utf8");
    assertIsolatedImports(content, relative(installedPackage, file).split("\\").join("/"), installedManifest);
    if (file.endsWith(".js")) assert.ok(!/import\s*["'][^"']+\.css["']/.test(content), "JavaScript entries must remain importable by Node without a CSS loader");
  }
  for (const name of ["button", "input", "select", "settings", "pill", "header-shell", "data-table", "pagination", "notice", "toast"]) {
    assert.ok(!(await readFile(join(installedPackage, `dist/${name}.js`), "utf8")).includes('"use client"'), `${name} must not create a client boundary`);
  }
  for (const name of ["modal", "confirm-dialog", "settings-rail", "expandable-pill", "segmented-control", "theme-toggle", "color-picker", "actions-menu"]) {
    assert.match(await readFile(join(installedPackage, `dist/${name}.js`), "utf8"), /^"use client";/, `${name} directive must survive compilation`);
  }
  const fixture: Fixture = { directory, consumer, artifacts, report: { package: { name: installedManifest.name, version: installedManifest.version, tarballBytes: pack.size, unpackedBytes: pack.unpackedSize, files: pack.files.length, sha256: digest }, environment: { next: manifest.dependencies.next, react: manifest.dependencies.react, tailwind: manifest.devDependencies.tailwindcss, tailwindPostcss: manifest.devDependencies["@tailwindcss/postcss"], bundler: "Clean Next production Webpack + Tailwind/PostCSS; esbuild isolated JS; Lightning CSS" } } };
  await run("node", ["node-ssr.mjs"], consumer);
  console.log("Node SSR passed. Measuring isolated JavaScript and styles...");
  const button = await measureJavaScript(consumer, artifacts, "button", "export { Button } from '@cosborn2/ui/button';");
  const modal = await measureJavaScript(consumer, artifacts, "modal", "export { Modal } from '@cosborn2/ui/modal';");
  const settings = await measureJavaScript(consumer, artifacts, "settings", "export { SettingsLayout, SettingsPageHeader, SettingsCard, SettingsCardHeader, SettingsRow, SettingsNavigation } from '@cosborn2/ui/settings';");
  const icon = await measureJavaScript(consumer, artifacts, "button-icon", "import { Button } from '@cosborn2/ui/button'; import { Settings } from 'lucide-react'; export function IconButton() { return <Button><Settings />Settings</Button>; }");
  assert.ok(button.gzip <= 1.5 * 1024, `Button exceeds 1.5 KiB gzip: ${button.gzip}`);
  assert.ok(modal.gzip <= 20 * 1024, `Modal exceeds proposed 20 KiB gzip budget: ${modal.gzip}. Investigate explicitly before changing the budget.`);
  assert.ok(!button.inputs.some((name) => /radix|lucide|modal|data-table|pagination|theme-toggle|color-picker|notice|toast|actions-menu|zustand|next\//.test(name)), "Button graph contains unrelated runtime code");
  assert.ok(!modal.inputs.some((name) => /react-dropdown-menu|react-popper|floating-ui|dist\/(?:actions-menu|toast|notice)\.js/.test(name)), "Modal graph contains unrelated menu/feedback code");
  const iconGlyphs = icon.inputs.filter((name) => /lucide-react\/.*\/icons\//.test(name));
  assert.equal(iconGlyphs.length, 1, `Expected exactly one emitted Lucide glyph, saw ${iconGlyphs.join(", ")}`);
  assert.match(iconGlyphs[0], /settings\.js$/);
  const buttonCss = await measureCss(consumer, artifacts, "theme-button", ["theme.css", "button.css"]);
  const modalCss = await measureCss(consumer, artifacts, "modal-css", ["modal.css"]);
  const settingsCss = await measureCss(consumer, artifacts, "settings-css", ["settings.css"]);
  const themeCss = await measureCss(consumer, artifacts, "theme", ["theme.css"]);
  assert.ok(buttonCss.gzip <= 3 * 1024, `Theme + Button CSS exceeds 3 KiB gzip: ${buttonCss.gzip}`);
  assert.ok(modalCss.gzip <= 3 * 1024, `Modal CSS exceeds 3 KiB gzip: ${modalCss.gzip}`);
  assert.ok(settingsCss.gzip <= 5 * 1024, `Settings CSS exceeds 5 KiB gzip: ${settingsCss.gzip}`);
  assert.ok(!/\.bnh-(?:settings|modal|glass|pill|data-table|pagination|theme-toggle|color-picker|notice|toast|actions-menu)/.test(buttonCss.text), "Button CSS includes unrelated selectors");
  assert.ok(!/\.bnh-(?:actions-menu|toast|notice)/.test(modalCss.text), "Modal CSS includes feedback/menu selectors");
  const cssSize = ({ text: _text, ...sizes }: typeof buttonCss) => sizes;
  fixture.report.javascript = { external: reactExternals, button, modal, settings, buttonIcon: icon };
  fixture.report.css = { theme: cssSize(themeCss), themeAndButton: cssSize(buttonCss), modal: cssSize(modalCss), settings: cssSize(settingsCss) };
  const additions: Record<string, unknown> = {};
  for (const [entry, component] of [["data-table", "DataTable"], ["pagination", "Pagination"], ["theme-toggle", "ThemeToggle"], ["color-picker", "ColorPicker"], ["notice", "Notice"], ["toast", "Toast, ToastViewport"]]) {
    const javascript = await measureJavaScript(consumer, artifacts, entry, `export { ${component} } from '@cosborn2/ui/${entry}';`);
    const css = await measureCss(consumer, artifacts, `${entry}-css`, [`${entry}.css`]);
    assert.ok(javascript.gzip <= 4 * 1024, `${entry} exceeds 4 KiB JS gzip budget: ${javascript.gzip}`);
    assert.ok(css.gzip <= 3 * 1024, `${entry} exceeds 3 KiB CSS gzip budget: ${css.gzip}`);
    assert.ok(!javascript.inputs.some((name) => /radix|modal|zustand|next\//.test(name)), `${entry} imports unrelated dialog/application code`);
    additions[entry] = { javascript, css: cssSize(css) };
  }
  const menuJavaScript = await measureJavaScript(consumer, artifacts, "actions-menu", "export { ActionsMenu } from '@cosborn2/ui/actions-menu';");
  const menuCss = await measureCss(consumer, artifacts, "actions-menu-css", ["actions-menu.css"]);
  assert.ok(menuJavaScript.gzip <= 30 * 1024, `ActionsMenu exceeds 30 KiB JS gzip budget: ${menuJavaScript.gzip}`);
  assert.ok(menuCss.gzip <= 2 * 1024, `ActionsMenu exceeds 2 KiB CSS gzip budget: ${menuCss.gzip}`);
  assert.ok(!menuJavaScript.inputs.some((name) => /react-dialog|dist\/(?:modal|toast|notice)\.js|zustand|next\//.test(name)), "ActionsMenu imports unrelated dialog/application code");
  additions["actions-menu"] = { javascript: menuJavaScript, css: cssSize(menuCss) };
  fixture.report.additions = additions;
  console.log(`Measured gzip bytes: Button ${button.gzip}; Modal ${modal.gzip}; theme + Button CSS ${buttonCss.gzip}.`);
  console.log("Building the isolated production Next Server Component consumer...");
  // Webpack treats node_modules as managed immutable paths. Reinstalling a
  // same-version tarball must not reuse transformed CSS/JS from an earlier pack.
  await rm(join(consumer, ".next"), { recursive: true, force: true });
  const nextBuild = await run("node", ["node_modules/next/dist/bin/next", "build", "--webpack"], consumer);
  await writeFile(join(artifacts, "next-build.log"), nextBuild.stdout + nextBuild.stderr);
  await buildPlainConsumer(fixture);
  await saveReport(fixture);
  return fixture;
}

async function buildPlainConsumer(fixture: Fixture) {
  const out = join(fixture.artifacts, "plain");
  await mkdir(out, { recursive: true });
  await build({ entryPoints: [join(fixture.consumer, "plain/client.tsx")], absWorkingDir: fixture.consumer, bundle: true, minify: true, jsx: "automatic", platform: "browser", format: "esm", outfile: join(out, "client.js"), define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const server = join(fixture.consumer, "plain/server.mjs");
  await build({ entryPoints: [join(fixture.consumer, "plain/server.tsx")], bundle: true, packages: "external", jsx: "automatic", platform: "node", format: "esm", outfile: server, logLevel: "silent" });
  for (const initialOpen of [false, true]) {
    const html = await run("node", [server, ...(initialOpen ? ["--initial-open"] : [])], fixture.consumer);
    assert.ok(!html.stdout.includes('role="dialog"'), "Portal content must not differ between server and initial hydration markup");
    await writeFile(join(out, initialOpen ? "initial-open.html" : "index.html"), html.stdout);
  }
}

export async function saveReport(fixture: Fixture) {
  await writeFile(join(fixture.artifacts, "report.json"), JSON.stringify(fixture.report, null, 2));
  console.log(`Verification report: ${join(fixture.artifacts, "report.json")}`);
}

export interface RunningServer { origin: string; stop: () => Promise<void> }

async function freePort() {
  const server = createServer();
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((accept, reject) => server.close((error) => error ? reject(error) : accept()));
  return port;
}

async function stopChild(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((accept) => {
    const timeout = setTimeout(() => { child.kill("SIGKILL"); accept(); }, 5000);
    child.once("exit", () => { clearTimeout(timeout); accept(); });
  });
}

export async function startNext(fixture: Fixture): Promise<RunningServer> {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn("node", ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: fixture.consumer, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (value) => { output += value; });
  child.stderr.on("data", (value) => { output += value; });
  const stop = async () => { await stopChild(child); await writeFile(join(fixture.artifacts, "next-server.log"), output); };
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next exited early: ${output}`);
    try {
      const response = await fetch(origin);
      if (response.ok) return { origin, stop };
    } catch { /* The production server may still be opening its socket. */ }
    await new Promise((accept) => setTimeout(accept, 100));
  }
  await stop();
  throw new Error(`Next did not become ready: ${output}`);
}

export async function startPlain(fixture: Fixture): Promise<RunningServer> {
  const directory = join(fixture.artifacts, "plain");
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url ?? "/", "http://fixture.invalid").pathname;
      const names: Record<string, string> = { "/": "index.html", "/initial-open": "initial-open.html", "/client.js": "client.js", "/client.css": "client.css" };
      const name = names[path];
      if (!name) { response.writeHead(404); response.end(); return; }
      response.setHeader("content-type", name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : "text/html");
      response.end(await readFile(join(directory, name)));
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    stop: () => new Promise<void>((accept, reject) => {
      if (!server.listening) { accept(); return; }
      server.close((error) => {
        if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") reject(error);
        else accept();
      });
      server.closeAllConnections();
    }),
  };
}

export async function verifyNextResponses(fixture: Fixture, origin: string) {
  const response = await fetch(origin, { headers: { "x-fixture-marker": "request-rendered-unique-value" } });
  assert.equal(response.status, 200);
  const html = await response.text();
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.match(withoutScripts, /Server settings fixture/);
  assert.match(withoutScripts, /Server save/);
  assert.match(withoutScripts, /request-rendered-unique-value/);
  assert.match(withoutScripts, /value="Server profile"/);
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  const scriptContents = await Promise.all(scripts.map(async (path) => (await fetch(new URL(path, origin))).text()));
  assert.ok(!scriptContents.some((source) => /bnh-button|bnh-settings-card|bnh-modal|bnh-input-field/.test(source)), "Server-only page ships library component code in browser scripts");
  const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"/g)].map((match) => match[1]);
  const css = (await Promise.all(styles.map(async (path) => (await fetch(new URL(path, origin))).text()))).join("\n");
  assert.match(css, /bnh-button/);
  assert.match(css, /bnh-settings-card/);
  assert.ok(!/\.bnh-modal/.test(css), "Server-only settings route received dialog CSS");
  const initial = await (await fetch(new URL("/initial-open", origin))).text();
  assert.ok(!initial.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").includes('role="dialog"'), "Initially open portaled content should wait for hydration");
  const icon = await (await fetch(new URL("/icon", origin))).text();
  assert.match(icon.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""), /<svg/);
  const data = await (await fetch(new URL("/data", origin))).text();
  const dataHtml = data.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.match(dataHtml, /Server record 1/);
  assert.match(dataHtml, /Server notice rendered without hydration/);
  assert.match(dataHtml, /Server toast presentation/);
  assert.match(dataHtml, /<caption[^>]*>Server records<\/caption>/);
  assert.match(dataHtml, /href="\/data\?page=1"/);
  const dataScripts = [...data.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
  const dataScriptContents = await Promise.all(dataScripts.map(async (path) => (await fetch(new URL(path, origin))).text()));
  assert.ok(!dataScriptContents.some((source) => /bnh-data-table|bnh-pagination|bnh-notice|bnh-toast/.test(source)), "Server data route ships table/pagination/notice/toast component code in browser scripts");
  const dataStyles = [...data.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"/g)].map((match) => match[1]);
  const dataCss = (await Promise.all(dataStyles.map(async (path) => (await fetch(new URL(path, origin))).text()))).join("\n");
  assert.match(dataCss, /bnh-data-table/);
  assert.match(dataCss, /bnh-pagination/);
  assert.match(dataCss, /bnh-notice/);
  assert.match(dataCss, /bnh-toast/);
  assert.ok(!/\.bnh-(?:modal|theme-toggle|color-picker|actions-menu)/.test(dataCss), "Server data route includes unrelated interactive control CSS");
  fixture.report.serverData = { tableInInitialHtml: true, paginationLinksInInitialHtml: true, noticeInInitialHtml: true, toastInInitialHtml: true, libraryCodeInBrowserScripts: false, unrelatedControlCss: false };
  await writeFile(join(fixture.artifacts, "next-server-data.html"), data);
  fixture.report.next = { serverRenderedRequestValue: true, serverControlsInInitialHtml: true, libraryCodeInServerRouteBrowserScripts: false, serverRouteScriptCount: scripts.length, serverRouteScriptGzipBytes: scriptContents.reduce((sum, content) => sum + compressed(content).gzip, 0), dialogCssInServerRoute: false, initialOpenPortalDeferred: true, serverLucideSvg: true };
  await writeFile(join(fixture.artifacts, "next-server-settings.html"), html);
  console.log("Production Next RSC HTML, server-only client graph, style isolation and icon rendering passed.");
}

export async function removeFixture(fixture: Fixture) {
  if (process.env.BNH_UI_KEEP_FIXTURE === "1") return;
  assert.ok(dirname(fixture.directory) === await realpath(tmpdir()) && fixture.directory.split("/").at(-1)?.startsWith("bnh-ui-verify-"));
  await rm(fixture.directory, { recursive: true, force: true });
}

if (import.meta.main) {
  let fixture: Fixture | undefined;
  let server: RunningServer | undefined;
  try {
    fixture = await prepareFixture();
    server = await startNext(fixture);
    await verifyNextResponses(fixture, server.origin);
    await saveReport(fixture);
    console.log(JSON.stringify(fixture.report, null, 2));
    await server.stop();
    server = undefined;
    await removeFixture(fixture);
  } finally {
    await server?.stop();
  }
}
