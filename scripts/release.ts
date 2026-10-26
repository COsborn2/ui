import { appendFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { gt, rcompare, valid } from "semver";
import { nextRelease, readPolicy, releaseChannel } from "./release-policy.js";

const packageName = "@cosborn2/ui";
const repository = "COsborn2/ui";
const bootstrapVersion = "0.1.0-beta.0";
const root = fileURLToPath(new URL("../", import.meta.url));

export interface PublishedVersion {
  name: string;
  version: string;
  gitHead?: string;
}

export function latestPublished(metadata: unknown): PublishedVersion {
  if (!metadata || typeof metadata !== "object" || !("name" in metadata) || metadata.name !== packageName
    || !("versions" in metadata) || !metadata.versions || typeof metadata.versions !== "object") {
    throw new Error("npm returned invalid package metadata.");
  }
  const versions = metadata.versions as Record<string, PublishedVersion>;
  const version = Object.keys(versions).filter(value => valid(value) === value).sort(rcompare)[0];
  if (!version) throw new Error("No published version exists; initial npm setup is required.");
  const published = versions[version];
  if (!published || published.name !== packageName || published.version !== version
    || (published.gitHead !== undefined && (typeof published.gitHead !== "string" || !/^[a-f0-9]{40}$/.test(published.gitHead)))) {
    throw new Error("npm returned invalid version metadata.");
  }
  releaseChannel(version);
  return published;
}

export function verifyReleaseRecord(published: PublishedVersion, tagHead: string | null, tags: string[]): string | null {
  const versionTags = tags.filter(tag => tag.startsWith("v") && valid(tag.slice(1)) === tag.slice(1));
  if (versionTags.some(tag => gt(tag.slice(1), published.version))) {
    throw new Error("A release tag is ahead of npm. Investigate before publishing another version.");
  }
  // The first beta was published from a tarball without gitHead or a Git tag.
  // Never manufacture its source history. Every subsequent release must have it.
  if (published.version === bootstrapVersion && !tagHead && !versionTags.length && !published.gitHead) return null;
  if (!published.gitHead) throw new Error("Published version has no source commit; cannot safely reconcile its release.");
  if (tagHead && tagHead !== published.gitHead) throw new Error("Release tag does not match npm's source commit.");
  return published.gitHead;
}

function command(program: string, args: string[], allowFailure = false): string | null {
  const result = spawnSync(program, args, { cwd: root, encoding: "utf8", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (allowFailure) return null;
    throw new Error(`${program} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}
const git = (...args: string[]) => command("git", args)!;

async function registry(): Promise<PublishedVersion> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
    headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`npm registry lookup failed: HTTP ${response.status}`);
  return latestPublished(await response.json());
}

async function github(path: string, method = "GET", body?: unknown): Promise<Response> {
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json", authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "x-github-api-version": "2022-11-28", "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok && !(method === "GET" && response.status === 404)) {
    throw new Error(`GitHub ${method} ${path} failed: HTTP ${response.status}`);
  }
  return response;
}

async function ensureReleaseRecord(published: PublishedVersion, tagHead: string | null): Promise<void> {
  const tag = `v${published.version}`;
  // Repair partial success (npm published, but tag/release failed), even if more
  // commits have reached main. Verify ancestry before touching any remote ref.
  if (!tagHead) {
    git("tag", "-a", tag, published.gitHead!, "-m", tag);
    git("push", "origin", `refs/tags/${tag}`);
  }
  const response = await github(`releases/tags/${encodeURIComponent(tag)}`);
  const prerelease = releaseChannel(published.version) === "beta";
  if (response.status === 404) {
    await github("releases", "POST", {
      tag_name: tag, target_commitish: published.gitHead, name: tag,
      generate_release_notes: true, prerelease, make_latest: prerelease ? "false" : "true",
    });
  } else {
    const release = await response.json() as { tag_name?: string; draft?: boolean; prerelease?: boolean };
    if (release.tag_name !== tag || release.draft || release.prerelease !== prerelease) {
      throw new Error("GitHub release metadata conflicts with the published version.");
    }
  }
}

async function summary(message: string): Promise<void> {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.GITHUB_REF !== "refs/heads/main"
      || process.env.GITHUB_REPOSITORY !== repository || !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")
      || !process.env.GITHUB_TOKEN) throw new Error("Publishing is restricted to the trusted main workflow.");
    // Keep credentials out of the checkout and command arguments. Git and the
    // release-it tag hook inherit this short-lived Actions authentication.
    process.env.GIT_CONFIG_COUNT = "1";
    process.env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    process.env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GITHUB_TOKEN}`).toString("base64")}`;
  }
  const head = git("rev-parse", "HEAD");
  if (!dryRun) {
    const remoteHead = git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0];
    if (head !== process.env.GITHUB_SHA || head !== remoteHead) {
      await summary("Main advanced; this run will not publish. The newer main run handles the release.");
      return;
    }
    if (git("status", "--porcelain")) throw new Error("Release checkout must be clean.");
    git("fetch", "origin", "--tags");
  }
  const policy = readPolicy(JSON.parse(await readFile(resolve(root, "release.json"), "utf8")));
  const published = await registry();
  const tag = `v${published.version}`;
  const tagHead = command("git", ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], true);
  const tags = git("tag", "--list", "v*").split("\n").filter(Boolean);
  const source = verifyReleaseRecord(published, tagHead, tags);
  if (source) {
    if (command("git", ["merge-base", "--is-ancestor", source, head], true) === null) {
      throw new Error("Published source commit is not an ancestor of this checkout.");
    }
    if (!dryRun) await ensureReleaseRecord(published, tagHead);
  }
  const changedPaths = source ? git("diff", "--name-only", source, head).split("\n") : ["package.json"];
  const target = nextRelease(policy, published.version, changedPaths);
  if (!target) {
    await summary(`No package changes since ${tag}; no new version needed.`);
    return;
  }
  await summary(`${dryRun ? "Would publish" : "Publishing"} ${packageName}@${target} to ${releaseChannel(target)} (previous: ${published.version}).`);
  if (dryRun) return;
  // Check again after network lookups. The release represents this verified SHA;
  // later merges queue behind it and are picked up by the next run.
  if (git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0] !== head) {
    await summary("Main advanced during release planning; deferring to its next run.");
    return;
  }
  const result = spawnSync("node", ["node_modules/release-it/bin/release-it.js", target, "--ci",
    `--npm.tag=${releaseChannel(target)}`, `--github.preRelease=${releaseChannel(target) === "beta"}`,
    `--github.makeLatest=${releaseChannel(target) === "latest"}`], {
    cwd: root, stdio: "inherit", env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Release failed. Re-run the main publishing workflow to reconcile partial publication.");
  const recorded = await registry();
  if (recorded.version !== target || recorded.gitHead !== head) throw new Error("npm publication did not match the intended version and source commit.");
  const remoteTags = git("ls-remote", "origin", `refs/tags/v${target}`, `refs/tags/v${target}^{}`);
  if (!remoteTags.split("\n").some(line => line.startsWith(`${head}\t`))) throw new Error("Published version is missing its exact remote source tag.");
  await summary(`Published ${packageName}@${target}. Older release lines are no longer maintained.`);
}

if (import.meta.main) await main();
