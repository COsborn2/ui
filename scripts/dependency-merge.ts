import { dependencyReviewState, inspectDependencyPolicy, type DependencyPolicyInspection, type PolicyPullRequest, type PolicyReview } from "./dependency-policy.js";

const SHA = /^[a-f0-9]{40}$/;
interface MergeOptions {
  repository: string;
  readToken: string;
  mergeToken: string;
  expectedPr: number;
  expectedHead: string;
  expectedBase: string;
  inspect?: () => DependencyPolicyInspection;
  fetchGitHub?: typeof fetch;
}

/** Revalidate with the workflow token, then use the owner PAT for one exact-head squash merge. */
export async function runDependencyMerge({ repository, readToken, mergeToken, expectedPr, expectedHead, expectedBase,
  inspect = inspectDependencyPolicy, fetchGitHub = fetch }: MergeOptions): Promise<string> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !Number.isSafeInteger(expectedPr) || expectedPr < 1
    || !SHA.test(expectedHead) || !SHA.test(expectedBase) || !readToken) throw new Error("Invalid validated PR, repository, or read credential.");
  if (!mergeToken) throw new Error("Set the repository Actions secret DEPENDABOT_AUTOMERGE_PAT to an owner token scoped to this repository; automatic merging is unavailable without it.");
  const { decision, input } = inspect();
  const validated = input.pullRequest;
  if (!decision.allowed || !decision.subject || !["dependency", "release"].includes(decision.kind ?? "")
    || input.repository !== repository || validated.number !== expectedPr || validated.head.sha !== expectedHead
    || validated.base.sha !== expectedBase || validated.base.ref !== "main" || validated.state !== "open" || validated.draft
    || validated.head.repo?.full_name !== repository || validated.base.repo.full_name !== repository) {
    throw new Error("Dependency policy, CI, or the validated PR/base/head changed; a new verification run is required.");
  }

  async function api<T>(path: string, method = "GET", body?: unknown, useMergeToken = false): Promise<T> {
    const response = await fetchGitHub(`https://api.github.com${path}`, {
      method,
      headers: { accept: "application/vnd.github+json", authorization: `Bearer ${useMergeToken ? mergeToken : readToken}`,
        "content-type": "application/json", "X-GitHub-Api-Version": "2026-03-10" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed (${response.status}); no protection override or queued merge was attempted.`);
    return response.json() as Promise<T>;
  }
  const identity = await api<{ login: string }>("/user", "GET", undefined, true);
  if (typeof identity.login !== "string" || identity.login.toLowerCase() !== repository.split("/")[0]!.toLowerCase()) throw new Error("The merge credential must belong to the repository owner with the existing review-only PR bypass.");
  const repoPath = `/repos/${repository}`;
  const reviews: PolicyReview[] = [];
  for (let page = 1; page <= 30; page++) {
    const entries = await api<PolicyReview[]>(`${repoPath}/pulls/${expectedPr}/reviews?per_page=100&page=${page}`);
    if (!Array.isArray(entries)) throw new Error("Invalid review response.");
    reviews.push(...entries);
    if (entries.length < 100) break;
    if (page === 30) throw new Error("Review history exceeds the supported page limit.");
  }
  const reviewState = dependencyReviewState(reviews, expectedHead);
  if (reviewState.changesRequested) throw new Error("An active changes-requested review blocks automatic merging, including requests on earlier commits.");
  if (!reviewState.automationApproved) throw new Error("The current head needs an active github-actions[bot] approval before merging.");

  const current = await api<PolicyPullRequest>(`${repoPath}/pulls/${expectedPr}`);
  const main = await api<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/main`);
  if (main.object.sha !== expectedBase || current.base.sha !== expectedBase || current.head.sha !== expectedHead
    || current.number !== expectedPr || current.state !== "open" || current.draft || current.base.ref !== "main"
    || current.base.repo.full_name !== repository || current.head.repo?.full_name !== repository
    || current.head.ref !== validated.head.ref || current.user.login !== validated.user.login
    || current.title !== validated.title || current.body !== validated.body) {
    throw new Error("PR identity, metadata, head, or main changed after validation; refusing to merge.");
  }

  // The SHA is a server-enforced compare-and-swap. The independent core ruleset
  // still enforces current CI, an up-to-date branch and resolved conversations.
  // GitHub has no base/review-state CAS; those are rechecked immediately above.
  const merged = await api<{ merged: boolean; sha: string }>(`${repoPath}/pulls/${expectedPr}/merge`, "PUT", {
    sha: expectedHead, merge_method: "squash", commit_title: decision.subject,
    commit_message: "Automated dependency maintenance validated against this exact pull request head. Required CI and repository protections remain enforced.",
  }, true);
  if (!merged.merged || !SHA.test(merged.sha)) throw new Error("GitHub did not confirm a successful squash merge.");
  return merged.sha;
}

if (import.meta.main) {
  if (process.env.GITHUB_REF !== "refs/heads/main") throw new Error("Automatic dependency merging runs only from trusted main.");
  const sha = await runDependencyMerge({
    repository: process.env.GITHUB_REPOSITORY ?? "", readToken: process.env.GH_TOKEN ?? "",
    mergeToken: process.env.DEPENDABOT_AUTOMERGE_PAT ?? "", expectedPr: Number(process.env.PR_NUMBER),
    expectedHead: process.env.PR_HEAD_SHA ?? "", expectedBase: process.env.PR_BASE_SHA ?? "",
  });
  console.log(`Merged the validated dependency PR as ${sha}.`);
}
