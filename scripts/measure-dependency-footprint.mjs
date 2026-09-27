// Estimate installed production dependencies from local package files; no registry access.
// node scripts/measure-dependency-footprint.mjs <report.json> [packed-ui.tgz]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootManifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const [outputPath, tarballPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: node script <report.json> [packed-ui.tgz]');
const excludedPeers = new Set(['react', 'react-dom']);
const packages = new Map();
const skippedOptionalDependencies = [];

function locate(name, parent) {
  const require = createRequire(path.join(parent, 'package.json'));
  try { return path.dirname(require.resolve(`${name}/package.json`)); } catch { /* Package exports may hide package.json. */ }
  let dir = path.dirname(require.resolve(name));
  while (dir !== path.dirname(dir)) {
    const manifest = path.join(dir, 'package.json');
    if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest, 'utf8')).name === name) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Cannot locate package ${name}`);
}

function size(dir) {
  let bytes = 0, files = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const filename = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const child = size(filename); bytes += child.bytes; files += child.files;
    } else if (entry.isFile()) { bytes += fs.statSync(filename).size; files++; }
  }
  return { bytes, files };
}

function visit(name, parent, optional = false) {
  if (excludedPeers.has(name)) return;
  let dir;
  try { dir = fs.realpathSync(locate(name, parent)); } catch (error) {
    if (!optional) throw error;
    skippedOptionalDependencies.push(name); return;
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const id = `${manifest.name}@${manifest.version}`;
  if (packages.has(id)) return;
  packages.set(id, { name: manifest.name, version: manifest.version, ...size(dir) });
  for (const dependency of Object.keys(manifest.dependencies ?? {})) visit(dependency, dir);
  for (const dependency of Object.keys(manifest.optionalDependencies ?? {})) visit(dependency, dir, true);
}
for (const name of Object.keys(rootManifest.dependencies ?? {})) visit(name, packageRoot);

let tarball = null;
if (tarballPath) {
  const compressed = fs.readFileSync(tarballPath), tar = gunzipSync(compressed);
  let unpackedBytes = 0, files = 0;
  for (let offset = 0; offset + 512 <= tar.length; ) {
    if (tar.subarray(offset, offset + 512).every(byte => byte === 0)) break;
    const fileSize = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0/g, '').trim() || '0', 8);
    const type = tar[offset + 156];
    if (type === 0 || type === 48) { unpackedBytes += fileSize; files++; }
    offset += 512 + Math.ceil(fileSize / 512) * 512;
  }
  tarball = { path: path.resolve(tarballPath), compressedBytes: compressed.length, unpackedBytes, files };
}
const uniquePackages = [...packages.values()].sort((a, b) => b.bytes - a.bytes);
const dependencyBytes = uniquePackages.reduce((total, pkg) => total + pkg.bytes, 0);
const report = {
  timestamp: new Date().toISOString(), name: rootManifest.name, version: rootManifest.version,
  directDependencies: rootManifest.dependencies, peers: rootManifest.peerDependencies,
  excludedPeers: [...excludedPeers], skippedOptionalDependencies,
  method: 'Sum logical regular-file bytes for locally resolved production and installed optional dependencies, deduplicated by package name/version. Excludes development dependencies, peer edges, nested node_modules, filesystem block overhead, package-manager caches, hardlink savings and registry download sizes. React/React DOM excluded even if encountered through dependency edges. Includes distributed source maps, types and icon inventory because installation includes them.',
  tarball, dependencyPackageCount: uniquePackages.length, dependencyBytes,
  uiPlusDependenciesUnpackedBytes: tarball ? tarball.unpackedBytes + dependencyBytes : null,
  packages: uniquePackages,
};
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, tarball, dependencyPackageCount: uniquePackages.length, dependencyBytes, largest: uniquePackages.slice(0, 5) }, null, 2));
