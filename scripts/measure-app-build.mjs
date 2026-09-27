// Measure an already completed Next.js Webpack production build, including its
// framework runtime. Run matching baseline/final builds before comparing reports:
// node scripts/measure-app-build.mjs <app-root> <report.json> <label> <git-sha>
// Baseline label assumes the app was built from a pristine git archive.
// Use identical NEXT_PUBLIC_* values when building both apps; this script never reads .env files.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const [appRoot, outputPath, label, gitSha] = process.argv.slice(2);
if (!appRoot || !outputPath) throw new Error('Usage: node script appRoot outputPath label gitSha');
const next = path.join(appRoot, '.next');
if (!fs.existsSync(path.join(next, 'BUILD_ID'))) throw new Error('No completed production BUILD_ID');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const assets = Object.fromEntries(walk(path.join(next, 'static')).filter(f => /\.(js|css)$/.test(f)).sort().map(f => {
  const source = fs.readFileSync(f);
  return [path.relative(next, f), {
    type: path.extname(f).slice(1), bytes: source.length,
    gzipBytes: gzipSync(source, { level: 9 }).length,
    brotliBytes: brotliCompressSync(source, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  }];
}));
function summary(files) {
  const normalized = [...new Set(files.map(file => assets[file] ? file : decodeURIComponent(file)))].sort();
  const unknown = normalized.filter(f => !assets[f]);
  if (unknown.length) throw new Error(`Unknown asset paths: ${unknown.join(', ')}`);
  const result = { files: normalized, js: { count: 0, bytes: 0, gzipBytes: 0, brotliBytes: 0 }, css: { count: 0, bytes: 0, gzipBytes: 0, brotliBytes: 0 } };
  for (const file of normalized) {
    const asset = assets[file], totals = result[asset.type];
    totals.count++;
    for (const size of ['bytes', 'gzipBytes', 'brotliBytes']) totals[size] += asset[size];
  }
  return result;
}
const build = JSON.parse(fs.readFileSync(path.join(next, 'build-manifest.json'), 'utf8'));
const appPaths = JSON.parse(fs.readFileSync(path.join(next, 'server/app-paths-manifest.json'), 'utf8'));
const routes = {};
for (const [entry, serverFile] of Object.entries(appPaths)) {
  if (!entry.endsWith('/page')) continue;
  const manifestPath = path.join(next, 'server', serverFile.replace(/\.js$/, '_client-reference-manifest.js'));
  if (!fs.existsSync(manifestPath)) continue;
  const context = {};
  vm.runInNewContext(fs.readFileSync(manifestPath, 'utf8'), context);
  const manifest = context.__RSC_MANIFEST[entry] ?? Object.values(context.__RSC_MANIFEST)[0];
  const routeSegments = entry.slice(1).split('/');
  routeSegments.pop();
  const relevantEntries = new Set(['not-found', 'global-error']);
  for (let depth = 0; depth <= routeSegments.length; depth++) {
    const prefix = routeSegments.slice(0, depth).join('/');
    for (const file of ['layout', 'loading', 'error', 'not-found', 'template', 'default']) relevantEntries.add([prefix, file].filter(Boolean).join('/'));
  }
  relevantEntries.add([...routeSegments, 'page'].join('/'));
  const isRelevantChunk = (chunk) => {
    const match = decodeURIComponent(chunk).match(/^static\/chunks\/app\/(.*)-[a-f0-9]+\.js$/);
    return match && relevantEntries.has(match[1]);
  };
  const javascript = Object.values(manifest.clientModules).flatMap(m => {
    const chunks = (m.chunks ?? []).filter(c => typeof c === 'string' && c.endsWith('.js'));
    return chunks.some(isRelevantChunk) ? chunks : [];
  });
  const css = Object.entries(manifest.entryCSSFiles).flatMap(([sourceEntry, values]) => {
    const relative = sourceEntry.split('/src/app/')[1];
    return relevantEntries.has(relative) ? values.filter(v => !v.inlined).map(v => v.path) : [];
  });
  const url = '/' + routeSegments.filter(s => !/^\(.*\)$/.test(s)).join('/');
  const htmlPath = path.join(next, 'server/app', url === '/' ? 'index.html' : `${url.slice(1)}.html`);
  let htmlAssets = null;
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const values = Array.from(html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^" ]+)"[^>]*>/g), m => m[1].replace(/^\/_next\//, '')).filter(s => s.startsWith('static/') && /\.(js|css)$/.test(s));
    htmlAssets = summary(values);
  }
  routes[entry] = {
    url,
    method: htmlAssets ? 'Actual prerendered script/link assets, excluding the nomodule polyfill.' : 'Relevant page/layout/loading/error client chunk groups plus root runtime; excludes unrelated sibling route groups and runtime lazy imports. Not a network trace.',
    entryAssets: htmlAssets ? summary(htmlAssets.files.filter(file => !file.includes('polyfills-'))) : summary([...(build.rootMainFiles ?? []), ...javascript, ...css]),
    prerenderedHtmlAssets: htmlAssets,
  };
}
const report = {
  label, gitSha, timestamp: new Date().toISOString(), appRoot, nextVersion: JSON.parse(fs.readFileSync(path.join(appRoot, 'node_modules/next/package.json'), 'utf8')).version,
  nodeVersion: process.version, bundler: 'webpack', buildId: fs.readFileSync(path.join(next, 'BUILD_ID'), 'utf8').trim(),
  notes: ['Clean production build. Per-file gzip level 9 and Brotli quality 11; route sizes sum separately compressed assets.', 'React/framework/runtime are included. Asset totals include every emitted static JS/CSS file, including lazy chunks, polyfills and manifests; excludes maps/fonts/images/HTML/RSC.', 'entryAssets are scoped build-manifest chunk groups, not measured navigation transfers. prerenderedHtmlAssets come from script/link tags and include the nomodule polyfill.', label === 'baseline' ? 'Baseline source is a git archive of HEAD with frozen lockfile install; no environment files or secrets copied.' : 'Final source includes working-tree extraction changes on the recorded git commit.', 'Default Turbopack baseline hit environment port EPERM, so both builds use webpack for this comparison.'],
  totals: summary(Object.keys(assets)),
  rootRuntime: summary(build.rootMainFiles ?? []),
  assets, routes,
};
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, label, gitSha, totals: { js: report.totals.js, css: report.totals.css }, routes: Object.keys(routes).length }, null, 2));
