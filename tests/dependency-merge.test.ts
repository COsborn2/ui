import { describe, expect, test, vi } from "vitest";
import { runDependencyMerge } from "../scripts/dependency-merge.js";
import { dependencyReviewState, type DependencyPolicyInspection, type PolicyReview } from "../scripts/dependency-policy.js";

const repository = "COsborn2/ui";
const base = "a".repeat(40);
const head = "b".repeat(40);
const other = "c".repeat(40);
const entry = "MQE_kwDO42";
function review(id: number, state: string, login = "github-actions[bot]", commit = head): PolicyReview {
  return { id, state, user: { login }, commit_id: commit };
}

function fixture() {
  const inspection: DependencyPolicyInspection = {
    decision: { allowed: true, kind: "dependency", reason: "Validated", subject: "fix(deps): update reviewed dependencies (#42)" },
    input: {
      repository, actor: "dependabot[bot]", expectedHead: head,
      pullRequest: { number: 42, title: "fix(deps): bump example from 1.0.0 to 1.0.1", body: "Upstream notes [skip ci]", state: "open", draft: false,
        user: { login: "dependabot[bot]" }, base: { ref: "main", sha: base, repo: { full_name: repository } },
        head: { ref: "dependabot/bun/example", sha: head, repo: { full_name: repository } }, commits: 1, changed_files: 2 },
      commits: [], files: [], metadata: [], basePackageJson: "{}", headPackageJson: "{}",
    },
  };
  const current: typeof inspection.input.pullRequest & { node_id?: string } = { ...structuredClone(inspection.input.pullRequest), node_id: "PR_kwDO42" };
  const state = { owner: "COsborn2", reviews: [review(1, "APPROVED")], enqueueStatus: 200,
    enqueueBody: { data: { enqueuePullRequest: { mergeQueueEntry: { id: entry } } } } as Record<string, unknown>,
    afterReviews: undefined as (() => void) | undefined };
  const calls: { path: string; method: string; token: string | null; body?: Record<string, unknown> }[] = [];
  const fetchGitHub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const method = init?.method ?? "GET";
    calls.push({ path, method, token: new Headers(init?.headers).get("authorization"), ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    if (path === "/user") return Response.json({ login: state.owner });
    if (path.endsWith("/reviews")) {
      const response = Response.json(state.reviews);
      state.afterReviews?.();
      return response;
    }
    if (path === "/graphql" && method === "POST") return Response.json(state.enqueueBody, { status: state.enqueueStatus });
    if (path.endsWith("/pulls/42")) return Response.json(current);
    throw new Error(`Unexpected request ${method} ${path}`);
  });
  const inspect = vi.fn(() => inspection);
  const options = { repository, readToken: "read-token", mergeToken: "merge-token", expectedPr: 42, expectedHead: head, expectedBase: base,
    inspect, fetchGitHub: fetchGitHub as unknown as typeof fetch };
  return { inspection, current, state, calls, options, inspect };
}

describe("dependency merge", () => {
  test("revalidates policy and queues only the exact validated head", async () => {
    const context = fixture();
    expect(await runDependencyMerge(context.options)).toBe(entry);
    expect(context.inspect).toHaveBeenCalledOnce();
    const mutations = context.calls.filter((call) => call.method !== "GET");
    expect(mutations).toEqual([{ path: "/graphql", method: "POST", token: "Bearer merge-token", body: {
      query: expect.stringContaining("enqueuePullRequest(input: { pullRequestId: $pullRequestId, expectedHeadOid: $expectedHeadOid })"),
      variables: { pullRequestId: "PR_kwDO42", expectedHeadOid: head },
    } }]);
    // The queue ignores commit text, so none is sent; the upstream body never reaches the request.
    expect(JSON.stringify(mutations)).not.toMatch(/commit|headline|skip ci/i);
    expect(context.calls.filter((call) => call.path !== "/user" && call.method === "GET").every((call) => call.token === "Bearer read-token")).toBe(true);
    expect(context.calls.at(-2)?.path).toBe("/repos/COsborn2/ui/pulls/42");
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

  test("cannot merge a maintainer PR even if an inspection incorrectly allows it", async () => {
    const context = fixture();
    context.inspection.input.pullRequest.user.login = "COsborn2";
    await expect(runDependencyMerge(context.options)).rejects.toThrow("policy, CI");
    expect(context.calls).toHaveLength(0);
  });

  test.each(["Dependency update [skip ci]", "bump example [ci skip]", "bump example\nskip-checks: true", "skip-checks: true"])(
    "refuses a title the squash commit cannot safely use (%j)", async (title) => {
      const context = fixture();
      context.inspection.input.pullRequest.title = title;
      context.current.title = title;
      await expect(runDependencyMerge(context.options)).rejects.toThrow("safe squash commit subject");
      expect(context.calls.some((call) => call.method !== "GET")).toBe(false);
    });

  test("queues even after main advances; the queue retests against the latest main", async () => {
    const context = fixture();
    expect(await runDependencyMerge(context.options)).toBe(entry);
    expect(context.calls.some((call) => call.path.endsWith("/git/ref/heads/main"))).toBe(false);
  });

  test.each(["expectedPr", "expectedHead", "expectedBase"] as const)("does not widen validation when %s changes", async (field) => {
    const context = fixture();
    const options = { ...context.options, [field]: field === "expectedPr" ? 43 : other };
    await expect(runDependencyMerge(options)).rejects.toThrow("validated PR/base/head changed");
    expect(context.calls).toHaveLength(0);
  });

  const unsafe: [string, (context: ReturnType<typeof fixture>) => void][] = [
    ["different token owner", (x) => { x.state.owner = "another-maintainer"; }],
    ["head advanced", (x) => { x.current.head.sha = other; }],
    ["base advanced", (x) => { x.current.base.sha = other; }],
    ["missing node id", (x) => { delete x.current.node_id; }],
    ["retargeted branch", (x) => { x.current.base.ref = "other"; }],
    ["forked head", (x) => { x.current.head.repo = { full_name: "outside/ui" }; }],
    ["changed author", (x) => { x.current.user.login = "someone"; }],
    ["changed title", (x) => { x.current.title = "Another change"; }],
    ["changed PR body", (x) => { x.current.body = "Different dependency metadata"; }],
    ["draft conversion", (x) => { x.current.draft = true; }],
    ["closed PR", (x) => { x.current.state = "closed"; }],
    ["no automated approval", (x) => { x.state.reviews = []; }],
    ["human approval only", (x) => { x.state.reviews = [review(1, "APPROVED", "COsborn2")]; }],
    ["stale automated approval", (x) => { x.state.reviews = [review(1, "APPROVED", "github-actions[bot]", base)]; }],
    ["dismissed automated approval", (x) => { x.state.reviews = [review(1, "DISMISSED")]; }],
    ["human changes requested on old commit", (x) => { x.state.reviews.push(review(2, "CHANGES_REQUESTED", "COsborn2", base)); }],
    ["comment after human changes requested", (x) => { x.state.reviews.push(review(2, "CHANGES_REQUESTED", "COsborn2", base), review(3, "COMMENTED", "COsborn2")); }],
  ];
  test.each(unsafe)("never queues for %s", async (_label, alter) => {
    const context = fixture(); alter(context);
    await expect(runDependencyMerge(context.options)).rejects.toThrow();
    expect(context.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test("rejects a base change while reviews are being read", async () => {
    const context = fixture();
    context.state.afterReviews = () => { context.current.base.sha = other; };
    await expect(runDependencyMerge(context.options)).rejects.toThrow("base changed after validation");
    expect(context.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test.each([403, 422])("does not retry or bypass a server refusal (%i)", async (status) => {
    const context = fixture(); context.state.enqueueStatus = status;
    await expect(runDependencyMerge(context.options)).rejects.toThrow(`failed (${status})`);
    expect(context.calls.filter((call) => call.method !== "GET")).toHaveLength(1);
  });

  test("surfaces a GraphQL refusal without retrying", async () => {
    const context = fixture();
    context.state.enqueueBody = { data: { enqueuePullRequest: null }, errors: [{ message: "Pull request is not mergeable" }] };
    await expect(runDependencyMerge(context.options)).rejects.toThrow("did not queue the validated head: Pull request is not mergeable");
    expect(context.calls.filter((call) => call.method !== "GET")).toHaveLength(1);
  });

  test("requires an explicit queue entry", async () => {
    const context = fixture(); context.state.enqueueBody = { data: { enqueuePullRequest: { mergeQueueEntry: null } } };
    await expect(runDependencyMerge(context.options)).rejects.toThrow("did not queue the validated head");
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
