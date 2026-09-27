import { isDeepStrictEqual } from "node:util";
import { decideRelease } from "./decide-release.js";

export const DEPENDENCY_RELEASE_BRANCH = "automation/dependency-release";
const ZERO_SHA = "0".repeat(40);
const PACKAGE_NAME = "@cosborn2/ui";
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;

export function nextDependencyReleaseVersion(version: string): string | null {
  const match = versionPattern.exec(version);
  if (!match || match[0] !== version) return null;
  const values = match.slice(1).filter((part) => part !== undefined).map(BigInt);
  if (values.some((value) => value >= BigInt(Number.MAX_SAFE_INTEGER))) return null;
  return match[4] === undefined
    ? `${match[1]}.${match[2]}.${BigInt(match[3]!) + 1n}`
    : `${match[1]}.${match[2]}.${match[3]}-beta.${BigInt(match[4]) + 1n}`;
}

export interface DependencyReleaseMarker { source: string; version: string; dependencyPr: number }
export function parseDependencyReleaseMarker(text: string): DependencyReleaseMarker | null {
  const matches = [...text.matchAll(/^<!-- dependency-release:v1 source=([a-f0-9]{40}) version=(\S+) dependency-pr=([1-9]\d*) -->$/gm)];
  if (matches.length !== 1) return null;
  const [, source, version, number] = matches[0]!;
  const dependencyPr = Number(number);
  if (!nextDependencyReleaseVersion(version!) || !Number.isSafeInteger(dependencyPr)) return null;
  return { source: source!, version: version!, dependencyPr };
}
export function dependencyReleaseTitle(version: string) { return `chore: release ${PACKAGE_NAME} ${version}`; }
function markerText(marker: DependencyReleaseMarker) {
  return `<!-- dependency-release:v1 source=${marker.source} version=${marker.version} dependency-pr=${marker.dependencyPr} -->`;
}
export function dependencyReleaseBody(marker: DependencyReleaseMarker) {
  return `Release the merged dependency update #${marker.dependencyPr}.\n\nThis PR changes only the package version. Required CI and release-policy checks must pass before merging; publication runs from main.\n\n${markerText(marker)}\n`;
}
function manifest(text: string): { name: string; version: string } {
  const value = JSON.parse(text);
  if (value?.name !== PACKAGE_NAME || typeof value.version !== "string") throw new Error("Unexpected package manifest");
  return value;
}
/** Preserve every byte outside the unique package version string. */
export function replacePackageVersion(text: string, version: string): string {
  const current = manifest(text);
  if (nextDependencyReleaseVersion(current.version) !== version) throw new Error("Release must use the next supported version");
  const matches = [...text.matchAll(/("version"\s*:\s*")([^"\r\n]*)(")/g)];
  if (matches.length !== 1 || matches[0]![2] !== current.version) throw new Error("Package version must be unambiguous");
  const match = matches[0]!;
  const result = text.slice(0, match.index) + match[1] + version + match[3] + text.slice(match.index! + match[0].length);
  if (!isDeepStrictEqual(JSON.parse(result), { ...JSON.parse(text), version })) throw new Error("Unexpected manifest change");
  return result;
}

type FileChange = { filename: string; status: string; previous_filename?: string };
type Commit = { sha: string; parents: { sha: string }[]; author: { login: string } | null; commit: { message: string; tree: { sha: string }; verification?: { verified: boolean } }; files: FileChange[] };
type Pull = { number: number; title: string; body: string | null; state: string; merged: boolean; merged_at: string | null; merge_commit_sha: string | null; commits: number; changed_files: number; user: { login: string }; head: { ref: string; sha: string; repo: { full_name: string } | null }; base: { ref: string; sha: string; repo: { full_name: string } } };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;
const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

export async function runDependencyRelease({ repository, token, fetchGitHub = fetch, fetchRegistry = fetch }: {
  repository: string; token: string; fetchGitHub?: Fetch; fetchRegistry?: Fetch;
}): Promise<string> {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || !token) throw new Error("Repository and DEPENDABOT_AUTOMERGE_PAT are required");
  const repoPath = `/repos/${repository}`;
  async function api<T>(path: string, method = "GET", body?: unknown, optional = false): Promise<T> {
    const response = await fetchGitHub(`https://api.github.com${path}`, {
      method, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "content-type": "application/json", "X-GitHub-Api-Version": "2026-03-10" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
    });
    if (optional && response.status === 404) return null as T;
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed (${response.status})`);
    return response.json() as Promise<T>;
  }
  async function list<T>(path: string): Promise<T[]> {
    const result: T[] = [];
    for (let page = 1; page <= 30; page++) {
      const values = await api<T[]>(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
      if (!Array.isArray(values)) throw new Error("Expected paginated GitHub metadata");
      result.push(...values);
      if (values.length < 100) return result;
    }
    throw new Error("GitHub metadata exceeds the supported page limit");
  }
  const commitCache = new Map<string, Commit>();
  const manifestCache = new Map<string, string>();
  async function getCommit(sha: string) {
    if (!commitCache.has(sha)) commitCache.set(sha, await api<Commit>(`${repoPath}/commits/${sha}?per_page=100`));
    return commitCache.get(sha)!;
  }
  async function getManifest(sha: string) {
    if (!manifestCache.has(sha)) {
      const file = await api<{ type: string; encoding: string; content: string }>(`${repoPath}/contents/package.json?ref=${sha}`);
      if (file.type !== "file" || file.encoding !== "base64") throw new Error("Expected package.json file contents");
      const text = Buffer.from(file.content, "base64").toString("utf8");
      manifest(text);
      manifestCache.set(sha, text);
    }
    return manifestCache.get(sha)!;
  }
  const [repo, user, mainRef] = await Promise.all([
    api<{ node_id: string; default_branch: string }>(repoPath), api<{ login: string; id: number }>("/user"),
    api<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/main`),
  ]);
  if (repo.default_branch !== "main") throw new Error("Dependency releases require main as the default branch");
  const source = mainRef.object.sha;
  const sourceText = await getManifest(source);
  const version = manifest(sourceText).version;
  const nextVersion = nextDependencyReleaseVersion(version);
  if (!nextVersion) throw new Error(`Unsupported dependency release version: ${version}`);
  let branchRef = await api<{ object: { sha: string } } | null>(`${repoPath}/git/ref/heads/${DEPENDENCY_RELEASE_BRANCH}`, "GET", undefined, true);
  const pulls = await list<Pull>(`${repoPath}/pulls?state=all&base=main&head=${encodeURIComponent(`${repository.split("/")[0]}:${DEPENDENCY_RELEASE_BRANCH}`)}`);
  const open = pulls.filter((pull) => pull.state === "open");
  if (open.length > 1 || (open.length && !branchRef)) throw new Error("Unexpected release branch or PR state");
  let pending: Pull | undefined = open[0];
  let closedStale = false;
  let previous: DependencyReleaseMarker | null = null;
  if (branchRef) {
    const head = await getCommit(branchRef.object.sha);
    previous = parseDependencyReleaseMarker(head.commit.message);
    if (!previous || head.parents.length !== 1 || head.parents[0]!.sha !== previous.source || !same(head.author?.login ?? "", user.login)
      || head.files.length !== 1 || head.files[0]!.filename !== "package.json" || head.files[0]!.status !== "modified") throw new Error("Refusing to overwrite an unrecognized automation branch");
    const before = await getManifest(previous.source);
    const expected = nextDependencyReleaseVersion(previous.version)!;
    if (manifest(before).version !== previous.version || await getManifest(head.sha) !== replacePackageVersion(before, expected)
      || head.commit.message !== `${dependencyReleaseTitle(expected)}\n\n${markerText(previous)}`) throw new Error("Automation branch is not an exact generated version change");
    const comparison = await api<{ status: string }>(`${repoPath}/compare/${previous.source}...${source}`);
    if (!["ahead", "identical"].includes(comparison.status)) throw new Error("Automation parent is not on current main");
    if (pending && (!same(pending.user.login, user.login) || !same(pending.head.repo?.full_name ?? "", repository)
      || pending.head.sha !== head.sha || pending.head.ref !== DEPENDENCY_RELEASE_BRANCH || pending.base.ref !== "main")) throw new Error("Unexpected release PR identity");
  }
  async function assertCurrentMain() {
    const current = await api<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/main`);
    if (current.object.sha !== source) throw new Error("Main changed during release preparation; rerun the workflow");
  }
  async function updateAutomationRef(afterOid: string) {
    await assertCurrentMain();
    const result = await api<{ data?: { updateRefs: object | null }; errors?: { message: string }[] }>("/graphql", "POST", {
      query: "mutation($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }",
      variables: { input: { repositoryId: repo.node_id, refUpdates: [{ name: `refs/heads/${DEPENDENCY_RELEASE_BRANCH}`, beforeOid: branchRef?.object.sha ?? ZERO_SHA, afterOid, force: true }] } },
    });
    if (result.errors?.length || !result.data?.updateRefs) throw new Error("Automation branch changed or its update was rejected; rerun after inspection");
  }
  if (pending && previous!.version !== version) {
    await assertCurrentMain();
    await api(`${repoPath}/pulls/${pending.number}`, "PATCH", { state: "closed" });
    await updateAutomationRef(ZERO_SHA);
    pending = undefined;
    branchRef = null;
    previous = null;
    closedStale = true;
  }

  // Walk only the current version's first-parent history: recovery does not
  // replay dependencies already included in a manually or automatically bumped version.
  let cursor = source;
  let dependencyPr: number | undefined;
  for (let depth = 0; depth < 100; depth++) {
    const commit = await getCommit(cursor);
    if (!commit.parents.length) break;
    if (commit.parents.length !== 1) throw new Error("Dependency release history must use squash merges");
    const parent = commit.parents[0]!.sha;
    if (manifest(await getManifest(parent)).version !== version) break;
    const associated = await list<{ number: number }>(`${repoPath}/commits/${cursor}/pulls`);
    for (const item of associated) {
      const pull = await api<Pull>(`${repoPath}/pulls/${item.number}`);
      if (!pull.merged || !pull.merged_at || pull.merge_commit_sha !== cursor || pull.user.login !== "dependabot[bot]"
        || !same(pull.head.repo?.full_name ?? "", repository) || !same(pull.base.repo.full_name, repository) || pull.base.ref !== "main") continue;
      const files = await list<FileChange>(`${repoPath}/pulls/${pull.number}/files`);
      if (files.length !== pull.changed_files) throw new Error("Incomplete dependency PR file metadata");
      if (!files.length || files.some((file) => file.status !== "modified" || file.previous_filename
        || !["package.json", "bun.lock"].includes(file.filename))) continue;
      const commits = await list<Commit>(`${repoPath}/pulls/${pull.number}/commits`);
      if (!Number.isSafeInteger(pull.number) || pull.number <= 0 || !/^[a-f0-9]{40}$/.test(pull.base.sha)
        || !commits.length || commits.length !== pull.commits || commits.at(-1)?.sha !== pull.head.sha
        || commits.some((value) => !/^[a-f0-9]{40}$/.test(value.sha) || value.author?.login !== "dependabot[bot]" || value.commit.verification?.verified !== true)) continue;
      dependencyPr = pull.number;
      break;
    }
    if (dependencyPr) break;
    cursor = parent;
    if (depth === 99) throw new Error("No version boundary within 100 commits; review the release version manually");
  }
  if (!dependencyPr) return closedStale
    ? "Closed the stale generated release PR because main already has a different version."
    : "No unreleased merged Dependabot package update found.";
  const rejected = pulls.find((pull) => pull.state === "closed" && !pull.merged_at && parseDependencyReleaseMarker(pull.body ?? "")?.dependencyPr === dependencyPr);
  if (!pending && rejected) return "The generated release for this dependency update was closed; leaving it closed.";
  const marker = { source, version, dependencyPr };
  const body = dependencyReleaseBody(marker);
  const title = dependencyReleaseTitle(nextVersion);
  const registry = await decideRelease({ name: PACKAGE_NAME, version: nextVersion, eventName: "push" }, fetchRegistry);
  if (!registry.shouldPublish) throw new Error(`${nextVersion} is already published; update the canonical package version manually`);
  if (pending && previous!.source === source) {
    if (pending.title !== title || pending.body !== body) await api(`${repoPath}/pulls/${pending.number}`, "PATCH", { title, body });
    return `Release PR #${pending.number} already covers current main.`;
  }
  await assertCurrentMain();
  const base = await getCommit(source);
  const tree = await api<{ sha: string }>(`${repoPath}/git/trees`, "POST", { base_tree: base.commit.tree.sha, tree: [{ path: "package.json", mode: "100644", type: "blob", content: replacePackageVersion(sourceText, nextVersion) }] });
  const identity = { name: user.login, email: `${user.id}+${user.login}@users.noreply.github.com` };
  const created = await api<{ sha: string }>(`${repoPath}/git/commits`, "POST", { message: `${title}\n\n${markerText(marker)}`, tree: tree.sha, parents: [source], author: identity, committer: identity });
  await updateAutomationRef(created.sha);
  if (pending) {
    await api(`${repoPath}/pulls/${pending.number}`, "PATCH", { title, body });
    return `Refreshed release PR #${pending.number} to ${nextVersion} on current main.`;
  }
  const pull = await api<{ number: number }>(`${repoPath}/pulls`, "POST", { title, body, head: DEPENDENCY_RELEASE_BRANCH, base: "main" });
  return `Created release PR #${pull.number} for ${nextVersion}.`;
}

if (import.meta.main) {
  if (process.env.GITHUB_REF !== "refs/heads/main" || !["push", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME ?? "")) throw new Error("Only main pushes and recovery dispatches may prepare dependency releases");
  console.log(await runDependencyRelease({ repository: process.env.GITHUB_REPOSITORY ?? "", token: process.env.GH_TOKEN ?? "" }));
}
