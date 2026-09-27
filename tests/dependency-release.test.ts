// @vitest-environment node
import { describe, expect, test, vi } from "vitest";
import { dependencyReleaseBody, dependencyReleaseTitle, nextDependencyReleaseVersion, parseDependencyReleaseMarker, replacePackageVersion, runDependencyRelease } from "../scripts/dependency-release.js";

const A = "a".repeat(40), B = "b".repeat(40), C = "c".repeat(40), D = "d".repeat(40), H = "e".repeat(40), NEW = "f".repeat(40);
const repository = "COsborn2/ui", prefix = `/repos/${repository}`;
const packageText = (version: string) => JSON.stringify({ name: "@cosborn2/ui", version, dependencies: { example: "1.0.0" } }, null, 2) + "\n";
const markerLine = (source: string, version: string, dependencyPr: number) => dependencyReleaseBody({ source, version, dependencyPr }).trim().split("\n").at(-1)!;

type Options = {
  version?: string; branch?: boolean; pending?: boolean; sameSource?: boolean;
  manualVersion?: boolean; newDependencyAfterManual?: boolean; docsAfterDependency?: boolean; actionOnly?: boolean;
  author?: string; sameRepo?: boolean; merged?: boolean; mixedAuthors?: boolean; unverified?: boolean;
  mixedOriginFiles?: boolean; renamedOriginFile?: boolean; addedOriginFile?: boolean; incompleteCommits?: boolean;
  headAuthor?: string; extraFile?: boolean; raceMainAt?: number; rejectLease?: boolean;
  published?: boolean; registryStatus?: number; closed?: boolean;
};
function scenario(options: Options = {}) {
  const version = options.version ?? "0.1.0-beta.1";
  const currentVersion = options.manualVersion || options.newDependencyAfterManual ? "0.1.0-beta.2" : version;
  const priorSource = options.sameSource ? A : options.newDependencyAfterManual ? C : B;
  const priorPr = options.sameSource ? 8 : 7;
  const next = nextDependencyReleaseVersion(version)!;
  const sourceMarker = { source: priorSource, version, dependencyPr: priorPr };
  const writes: { path: string; body: any }[] = [];
  let mainReads = 0;
  const pull = (number: number, sha: string) => ({
    number, title: "Dependency update", body: "Upstream release notes", state: "closed", merged: options.merged ?? true,
    merged_at: options.merged === false ? null : "2026-09-27T00:00:00Z", merge_commit_sha: sha,
    commits: options.mixedAuthors ? 2 : 1, changed_files: options.mixedOriginFiles ? 2 : 1,
    user: { login: options.author ?? "dependabot[bot]" },
    head: { ref: "dependabot/bun/example", sha: H, repo: { full_name: options.sameRepo === false ? "other/ui" : repository } },
    base: { ref: "main", sha: C, repo: { full_name: repository } },
  });
  const pending = {
    ...pull(99, H), title: dependencyReleaseTitle(next), body: dependencyReleaseBody(sourceMarker), state: options.closed ? "closed" : "open", merged: false, merged_at: null,
    user: { login: "COsborn2" }, head: { ref: "automation/dependency-release", sha: H, repo: { full_name: repository } },
  };
  const commits = new Map([
    [A, { parent: B, version: currentVersion }], [B, { parent: C, version: options.newDependencyAfterManual ? currentVersion : version }],
    [C, { parent: D, version }], [D, { parent: null, version: "0.1.0-beta.0" }],
  ]);
  const fetchGitHub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (method !== "GET") {
      writes.push({ path, body });
      if (path === `${prefix}/git/trees`) return Response.json({ sha: "tree" });
      if (path === `${prefix}/git/commits`) return Response.json({ sha: NEW });
      if (path === "/graphql") return Response.json(options.rejectLease ? { errors: [{ message: "Reference does not match expected oid" }] } : { data: { updateRefs: { clientMutationId: null } } });
      if (path === `${prefix}/pulls`) return Response.json({ number: 99 });
      if (path === `${prefix}/pulls/99`) return Response.json({ number: 99, ...body });
      throw new Error(`Unexpected write ${method} ${path}`);
    }
    if (path === prefix) return Response.json({ node_id: "repo-id", default_branch: "main" });
    if (path === "/user") return Response.json({ login: "COsborn2", id: 18077107 });
    if (path === `${prefix}/git/ref/heads/main`) {
      mainReads++;
      return Response.json({ object: { sha: options.raceMainAt && mainReads >= options.raceMainAt ? NEW : A } });
    }
    if (path === `${prefix}/git/ref/heads/automation/dependency-release`) return options.branch ? Response.json({ object: { sha: H } }) : new Response(null, { status: 404 });
    if (path === `${prefix}/pulls`) return Response.json(options.pending || options.closed ? [pending] : []);
    if (path === `${prefix}/contents/package.json`) {
      const sha = url.searchParams.get("ref")!;
      const text = sha === H ? replacePackageVersion(packageText(version), next) : packageText(commits.get(sha)!.version);
      return Response.json({ type: "file", encoding: "base64", content: Buffer.from(text).toString("base64") });
    }
    if (path.startsWith(`${prefix}/compare/`)) return Response.json({ status: options.sameSource ? "identical" : "ahead" });
    const commitMatch = path.match(/\/commits\/([a-f0-9]{40})$/);
    if (commitMatch) {
      const sha = commitMatch[1]!;
      if (sha === H) return Response.json({ sha, parents: [{ sha: priorSource }], author: { login: options.headAuthor ?? "COsborn2" },
        commit: { message: `${dependencyReleaseTitle(next)}\n\n${markerLine(priorSource, version, priorPr)}`, tree: { sha: "old-tree" } },
        files: [{ filename: "package.json", status: "modified" }, ...(options.extraFile ? [{ filename: "src/button.tsx", status: "modified" }] : [])] });
      const item = commits.get(sha)!;
      return Response.json({ sha, parents: item.parent ? [{ sha: item.parent }] : [], author: { login: "COsborn2" }, commit: { message: "Main commit", tree: { sha: `tree-${sha}` } }, files: [] });
    }
    const associated = path.match(/\/commits\/([a-f0-9]{40})\/pulls$/);
    if (associated) return Response.json(associated[1] === A ? options.docsAfterDependency ? [] : [{ number: 8 }] : associated[1] === B ? [{ number: 7 }] : []);
    const sourcePull = path.match(/\/pulls\/([78])$/);
    if (sourcePull) return Response.json(pull(Number(sourcePull[1]), sourcePull[1] === "8" ? A : B));
    if (/\/pulls\/[78]\/files$/.test(path)) return Response.json([
      { filename: options.actionOnly ? ".github/workflows/ui-package.yml" : "bun.lock", status: options.addedOriginFile ? "added" : "modified", ...(options.renamedOriginFile ? { previous_filename: "old.lock" } : {}) },
      ...(options.mixedOriginFiles ? [{ filename: "src/button.tsx", status: "modified" }] : []),
    ]);
    if (/\/pulls\/[78]\/commits$/.test(path)) return Response.json([
      { sha: options.incompleteCommits ? B : H, author: { login: "dependabot[bot]" }, commit: { verification: { verified: !options.unverified } } },
      ...(options.mixedAuthors ? [{ sha: H, author: { login: "maintainer" }, commit: { verification: { verified: true } } }] : []),
    ]);
    throw new Error(`Unexpected read ${path}`);
  });
  const fetchRegistry = vi.fn(async () => options.published ? Response.json({ name: "@cosborn2/ui", version: next }) : new Response(null, { status: options.registryStatus ?? 404 }));
  return { writes, fetchGitHub, fetchRegistry, run: () => runDependencyRelease({ repository, token: "test-token", fetchGitHub, fetchRegistry }) };
}

describe("dependency release versions and metadata", () => {
  test.each([["0.1.0", "0.1.1"], ["1.9.99", "1.9.100"], ["0.1.0-beta.0", "0.1.0-beta.1"], ["2.0.0-beta.9", "2.0.0-beta.10"]])("increments %s to %s without promoting a beta", (current, next) => {
    expect(nextDependencyReleaseVersion(current)).toBe(next);
  });
  test.each(["latest", "01.0.0", "1.0.0-beta.01", "1.0.0-rc.1", "1.0.0-alpha.1", "1.0.0+build", "1.0.0\n", "1.0.9007199254740991"])("rejects unsupported version %j", (version) => {
    expect(nextDependencyReleaseVersion(version)).toBeNull();
  });
  test("preserves manifest formatting, dependency values and all non-version bytes", () => {
    const text = '{\r\n  "name": "@cosborn2/ui",\r\n  "version" : "1.2.3",\r\n  "dependencies": {"example": "1.2.3"}\r\n}\r\n';
    expect(replacePackageVersion(text, "1.2.4")).toBe(text.replace('"version" : "1.2.3"', '"version" : "1.2.4"'));
    expect(() => replacePackageVersion(text, "1.3.0")).toThrow("next supported version");
    expect(() => replacePackageVersion('{"name":"@cosborn2/ui","version":"1.2.3","nested":{"version":"1.2.3"}}', "1.2.4")).toThrow("unambiguous");
  });
  test("parses exactly one controlled origin marker and rejects ambiguity", () => {
    const value = { source: A, version: "1.2.3", dependencyPr: 42 };
    const body = dependencyReleaseBody(value);
    expect(parseDependencyReleaseMarker(body)).toEqual(value);
    expect(parseDependencyReleaseMarker(body + body)).toBeNull();
    expect(parseDependencyReleaseMarker(body.replace(A, "not-a-sha"))).toBeNull();
    expect(parseDependencyReleaseMarker(body.replace("dependency-pr=42", "dependency-pr=0"))).toBeNull();
  });
});

describe("dependency release preparation", () => {
  test("proposes only a version change after a verified merged dependency update", async () => {
    const fixture = scenario();
    expect(await fixture.run()).toBe("Created release PR #99 for 0.1.0-beta.2.");
    const tree = fixture.writes.find((write) => write.path.endsWith("/git/trees"))!.body;
    expect(tree.base_tree).toBe(`tree-${A}`);
    expect(tree.tree).toEqual([{ path: "package.json", mode: "100644", type: "blob", content: packageText("0.1.0-beta.2") }]);
    expect(fixture.writes.find((write) => write.path.endsWith("/git/commits"))!.body.parents).toEqual([A]);
    expect(fixture.writes.find((write) => write.path === "/graphql")!.body.variables.input.refUpdates).toEqual([
      { name: "refs/heads/automation/dependency-release", beforeOid: "0".repeat(40), afterOid: NEW, force: true },
    ]);
    const created = fixture.writes.at(-1)!.body;
    expect(created.head).toBe("automation/dependency-release");
    expect(created.base).toBe("main");
    expect(created.title).toBe("chore: release @cosborn2/ui 0.1.0-beta.2");
    expect(parseDependencyReleaseMarker(created.body)).toEqual({ source: A, version: "0.1.0-beta.1", dependencyPr: 8 });
  });
  test("dispatch recovery finds an eligible merge before a later documentation change", async () => {
    const fixture = scenario({ docsAfterDependency: true });
    await fixture.run();
    expect(parseDependencyReleaseMarker(fixture.writes.at(-1)!.body.body)?.dependencyPr).toBe(7);
  });
  test.each([{ actionOnly: true }, { author: "maintainer" }, { sameRepo: false }, { merged: false }, { mixedAuthors: true }, { unverified: true }, { mixedOriginFiles: true }, { renamedOriginFile: true }, { addedOriginFile: true }, { incompleteCommits: true }])("does not release ineligible changes: %j", async (options) => {
    const fixture = scenario(options);
    expect(await fixture.run()).toContain("No unreleased");
    expect(fixture.writes).toEqual([]);
    expect(fixture.fetchRegistry).not.toHaveBeenCalled();
  });
  test("a version bump on main includes older dependencies without another automatic bump", async () => {
    const fixture = scenario({ manualVersion: true });
    expect(await fixture.run()).toContain("No unreleased");
    expect(fixture.writes).toEqual([]);
  });
  test("refreshes the existing version PR from current main without incrementing it twice", async () => {
    const fixture = scenario({ branch: true, pending: true });
    expect(await fixture.run()).toBe("Refreshed release PR #99 to 0.1.0-beta.2 on current main.");
    expect(fixture.writes.filter((write) => write.path === `${prefix}/pulls`)).toEqual([]);
    expect(fixture.writes.find((write) => write.path === "/graphql")!.body.variables.input.refUpdates[0].beforeOid).toBe(H);
    expect(parseDependencyReleaseMarker(fixture.writes.at(-1)!.body.body)?.source).toBe(A);
  });
  test("rerunning the same main and generated PR is a no-op", async () => {
    const fixture = scenario({ branch: true, pending: true, sameSource: true });
    expect(await fixture.run()).toContain("already covers current main");
    expect(fixture.writes).toEqual([]);
  });
  test("a maintainer version bump closes a stale generated PR and only deletes its validated branch", async () => {
    const fixture = scenario({ branch: true, pending: true, manualVersion: true });
    expect(await fixture.run()).toContain("Closed the stale");
    expect(fixture.writes).toHaveLength(2);
    expect(fixture.writes[0]).toEqual({ path: `${prefix}/pulls/99`, body: { state: "closed" } });
    expect(fixture.writes[1]!.body.variables.input.refUpdates).toEqual([{ name: "refs/heads/automation/dependency-release", beforeOid: H, afterOid: "0".repeat(40), force: true }]);
    expect(fixture.fetchRegistry).not.toHaveBeenCalled();
  });
  test("after a manual bump, closes the stale proposal and releases a genuinely newer dependency merge in the same run", async () => {
    const fixture = scenario({ branch: true, pending: true, newDependencyAfterManual: true });
    expect(await fixture.run()).toBe("Created release PR #99 for 0.1.0-beta.3.");
    expect(fixture.writes[0]).toEqual({ path: `${prefix}/pulls/99`, body: { state: "closed" } });
    const refUpdates = fixture.writes.filter((write) => write.path === "/graphql").map((write) => write.body.variables.input.refUpdates[0]);
    expect(refUpdates).toEqual([
      { name: "refs/heads/automation/dependency-release", beforeOid: H, afterOid: "0".repeat(40), force: true },
      { name: "refs/heads/automation/dependency-release", beforeOid: "0".repeat(40), afterOid: NEW, force: true },
    ]);
    expect(parseDependencyReleaseMarker(fixture.writes.at(-1)!.body.body)).toEqual({ source: A, version: "0.1.0-beta.2", dependencyPr: 8 });
  });
  test("an externally published version is rejected even when the pending PR already covers main", async () => {
    const fixture = scenario({ branch: true, pending: true, sameSource: true, published: true });
    await expect(fixture.run()).rejects.toThrow("already published");
    expect(fixture.writes).toEqual([]);
  });
  test("does not reopen a release intentionally closed for the same update", async () => {
    const fixture = scenario({ branch: true, sameSource: true, closed: true });
    expect(await fixture.run()).toContain("leaving it closed");
    expect(fixture.writes).toEqual([]);
  });
  test.each([{ headAuthor: "someone-else" }, { extraFile: true }])("refuses to overwrite unexpected branch contents or ownership: %j", async (options) => {
    const fixture = scenario({ branch: true, pending: true, ...options });
    await expect(fixture.run()).rejects.toThrow("unrecognized automation branch");
    expect(fixture.writes).toEqual([]);
  });
  test.each([2, 3])("stops when main moves during preparation at read %i", async (raceMainAt) => {
    const fixture = scenario({ raceMainAt });
    await expect(fixture.run()).rejects.toThrow("Main changed");
    expect(fixture.writes.some((write) => write.path === "/graphql" || write.path === `${prefix}/pulls`)).toBe(false);
  });
  test("the atomic branch lease prevents overwriting a concurrent change", async () => {
    const fixture = scenario({ branch: true, pending: true, rejectLease: true });
    await expect(fixture.run()).rejects.toThrow("Automation branch changed");
    expect(fixture.writes.some((write) => write.path === `${prefix}/pulls/99`)).toBe(false);
  });
  test.each([{ published: true }, { registryStatus: 503 }])("does not propose a colliding version or ignore registry failures: %j", async (options) => {
    const fixture = scenario(options);
    await expect(fixture.run()).rejects.toThrow();
    expect(fixture.writes).toEqual([]);
  });
  test("requires an explicit PAT before calling GitHub", async () => {
    const fetchGitHub = vi.fn();
    await expect(runDependencyRelease({ repository, token: "", fetchGitHub })).rejects.toThrow("DEPENDABOT_AUTOMERGE_PAT");
    expect(fetchGitHub).not.toHaveBeenCalled();
  });
});
