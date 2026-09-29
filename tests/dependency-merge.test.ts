import { describe, expect, test, vi } from "vitest";
import { runDependencyMerge } from "../scripts/dependency-merge.js";
import { dependencyReviewState, type DependencyPolicyInspection, type PolicyReview } from "../scripts/dependency-policy.js";

const repository = "COsborn2/ui";
const base = "a".repeat(40);
const head = "b".repeat(40);
const merged = "c".repeat(40);
function review(id: number, state: string, login = "github-actions[bot]", commit = head): PolicyReview {
  return { id, state, user: { login }, commit_id: commit };
}

function fixture() {
  const inspection: DependencyPolicyInspection = {
    decision: { allowed: true, kind: "dependency", reason: "Validated", subject: "fix(deps): update reviewed dependencies (#42)" },
    input: {
      repository, actor: "dependabot[bot]", expectedHead: head, trustedReleaseAuthor: "COsborn2",
      pullRequest: { number: 42, title: "Dependency update [skip ci]", body: "Upstream notes", state: "open", draft: false,
        user: { login: "dependabot[bot]" }, base: { ref: "main", sha: base, repo: { full_name: repository } },
        head: { ref: "dependabot/bun/example", sha: head, repo: { full_name: repository } }, commits: 1, changed_files: 2 },
      commits: [], files: [], metadata: [], basePackageJson: "{}", headPackageJson: "{}",
    },
  };
  const current = structuredClone(inspection.input.pullRequest);
  const state = { owner: "COsborn2", main: base, reviews: [review(1, "APPROVED")], mergeStatus: 200, merged: true, afterReviews: undefined as (() => void) | undefined };
  const calls: { path: string; method: string; token: string | null; body?: Record<string, unknown> }[] = [];
  const fetchGitHub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? "GET";
    calls.push({ path, method, token: new Headers(init?.headers).get("authorization"), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (path === "/user") return Response.json({ login: state.owner });
    if (path.endsWith("/git/ref/heads/main")) return Response.json({ object: { sha: state.main } });
    if (path.endsWith("/reviews")) {
      const response = Response.json(state.reviews);
      state.afterReviews?.();
      return response;
    }
    if (path.endsWith("/merge") && method === "PUT") return Response.json({ merged: state.merged, sha: merged }, { status: state.mergeStatus });
    if (path.endsWith("/pulls/42")) return Response.json(current);
    throw new Error(`Unexpected request ${method} ${path}`);
  });
  const inspect = vi.fn(() => inspection);
  const options = { repository, readToken: "read-token", mergeToken: "merge-token", expectedPr: 42, expectedHead: head, expectedBase: base,
    inspect, fetchGitHub: fetchGitHub as unknown as typeof fetch };
  return { inspection, current, state, calls, options, inspect };
}

describe("dependency merge", () => {
  test("revalidates policy and sends a single exact-head squash with controlled commit text", async () => {
    const context = fixture();
    expect(await runDependencyMerge(context.options)).toBe(merged);
    expect(context.inspect).toHaveBeenCalledOnce();
    const mutations = context.calls.filter((call) => call.method !== "GET");
    expect(mutations).toEqual([{ path: "/repos/COsborn2/ui/pulls/42/merge", method: "PUT", token: "Bearer merge-token", body: {
      sha: head, merge_method: "squash", commit_title: "fix(deps): update reviewed dependencies (#42)",
      commit_message: "Automated dependency maintenance validated against this exact pull request head. Required CI and repository protections remain enforced.",
    } }]);
    expect(JSON.stringify(mutations)).not.toContain("skip ci");
    expect(context.calls.filter((call) => call.path !== "/user" && call.method === "GET").every((call) => call.token === "Bearer read-token")).toBe(true);
    expect(context.calls.at(-2)?.path).toMatch(/\/git\/ref\/heads\/main$/);
  });

  test("does not make API requests when the credential is absent or policy now refuses", async () => {
    const missing = fixture();
    await expect(runDependencyMerge({ ...missing.options, mergeToken: "" })).rejects.toThrow("DEPENDABOT_AUTOMERGE_PAT");
    expect(missing.calls).toHaveLength(0);
    const denied = fixture();
    denied.inspection.decision = { allowed: false, reason: "New unsafe change" };
    await expect(runDependencyMerge(denied.options)).rejects.toThrow("policy, CI");
    expect(denied.calls).toHaveLength(0);
  });

  test.each(["expectedPr", "expectedHead", "expectedBase"] as const)("does not widen validation when %s changes", async (field) => {
    const context = fixture();
    const options = { ...context.options, [field]: field === "expectedPr" ? 43 : merged };
    await expect(runDependencyMerge(options)).rejects.toThrow("validated PR/base/head changed");
    expect(context.calls).toHaveLength(0);
  });

  const unsafe: [string, (context: ReturnType<typeof fixture>) => void][] = [
    ["different token owner", (x) => { x.state.owner = "another-maintainer"; }],
    ["main advanced", (x) => { x.state.main = merged; }],
    ["head advanced", (x) => { x.current.head.sha = merged; }],
    ["base advanced", (x) => { x.current.base.sha = merged; }],
    ["retargeted branch", (x) => { x.current.base.ref = "other"; }],
    ["forked head", (x) => { x.current.head.repo = { full_name: "outside/ui" }; }],
    ["changed author", (x) => { x.current.user.login = "someone"; }],
    ["changed title", (x) => { x.current.title = "Another change"; }],
    ["changed release marker/body", (x) => { x.current.body = "Another marker"; }],
    ["draft conversion", (x) => { x.current.draft = true; }],
    ["closed PR", (x) => { x.current.state = "closed"; }],
    ["no automated approval", (x) => { x.state.reviews = []; }],
    ["human approval only", (x) => { x.state.reviews = [review(1, "APPROVED", "COsborn2")]; }],
    ["stale automated approval", (x) => { x.state.reviews = [review(1, "APPROVED", "github-actions[bot]", base)]; }],
    ["dismissed automated approval", (x) => { x.state.reviews = [review(1, "DISMISSED")]; }],
    ["human changes requested on old commit", (x) => { x.state.reviews.push(review(2, "CHANGES_REQUESTED", "COsborn2", base)); }],
    ["comment after human changes requested", (x) => { x.state.reviews.push(review(2, "CHANGES_REQUESTED", "COsborn2", base), review(3, "COMMENTED", "COsborn2")); }],
  ];
  test.each(unsafe)("never sends a merge for %s", async (_label, alter) => {
    const context = fixture(); alter(context);
    await expect(runDependencyMerge(context.options)).rejects.toThrow();
    expect(context.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test("rejects a base change while reviews are being read", async () => {
    const context = fixture();
    context.state.afterReviews = () => { context.state.main = merged; context.current.base.sha = merged; };
    await expect(runDependencyMerge(context.options)).rejects.toThrow("main changed after validation");
    expect(context.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test.each([405, 409])( "does not retry or bypass a server refusal (%i)", async (status) => {
    const context = fixture(); context.state.mergeStatus = status;
    await expect(runDependencyMerge(context.options)).rejects.toThrow(`failed (${status})`);
    expect(context.calls.filter((call) => call.method !== "GET")).toHaveLength(1);
  });

  test("requires an explicit successful merge response", async () => {
    const context = fixture(); context.state.merged = false;
    await expect(runDependencyMerge(context.options)).rejects.toThrow("did not confirm");
  });
});

describe("review state", () => {
  test("comments and pending reviews cannot clear a changes request", () => {
    expect(dependencyReviewState([review(1, "CHANGES_REQUESTED", "COsborn2", base), review(2, "COMMENTED", "COsborn2"), review(3, "PENDING", "COsborn2")], head).changesRequested).toBe(true);
  });
  test.each(["APPROVED", "DISMISSED"])("a later %s decision resolves that reviewer's request", (state) => {
    expect(dependencyReviewState([review(1, "CHANGES_REQUESTED", "COsborn2", base), review(2, state, "COsborn2")], head).changesRequested).toBe(false);
  });
  test("another reviewer's approval cannot resolve a changes request", () => {
    expect(dependencyReviewState([review(1, "CHANGES_REQUESTED", "COsborn2", base), review(2, "APPROVED", "OtherMaintainer")], head).changesRequested).toBe(true);
  });
  test("bot comments do not discard its current approval, but dismissal does", () => {
    expect(dependencyReviewState([review(1, "APPROVED"), review(2, "COMMENTED")], head).automationApproved).toBe(true);
    expect(dependencyReviewState([review(1, "APPROVED"), review(2, "DISMISSED")], head).automationApproved).toBe(false);
  });
});
