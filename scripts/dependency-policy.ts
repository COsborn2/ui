import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { nextDependencyReleaseVersion, parseDependencyReleaseMarker, replacePackageVersion } from "./dependency-release.js";

const BOT = "dependabot[bot]";
const SHA = /^[a-f0-9]{40}$/;
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"] as const;
const UPDATE_TYPES = ["version-update:semver-patch", "version-update:semver-minor"];

export interface PolicyPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  user: { login: string };
  base: { ref: string; sha: string; repo: { full_name: string } };
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  commits: number;
  changed_files: number;
  merged?: boolean;
  merge_commit_sha?: string | null;
}
export interface PolicyCommit {
  sha: string;
  author: { login: string } | null;
  committer?: { login: string } | null;
  commit: { verification?: { verified: boolean }; message?: string };
  parents: { sha: string }[];
}
export interface PolicyFile { filename: string; status: string; previous_filename?: string }
export interface PolicyWorkflowFile { filename: string; before: string; after: string }
export interface DependencyPolicyInput {
  repository: string;
  /** Actor of the successful CI run, not an untrusted PR body value. */
  actor: string;
  expectedHead: string;
  trustedReleaseAuthor: string;
  pullRequest: PolicyPullRequest;
  commits: PolicyCommit[];
  files: PolicyFile[];
  basePackageJson: string;
  headPackageJson: string;
  /** Structured data extracted from verified Dependabot commit metadata. */
  metadata: unknown;
  /** Parsed as data by the caller; no Bun-only APIs are needed in this pure policy. */
  baseLockfile?: unknown;
  headLockfile?: unknown;
  workflowFiles?: PolicyWorkflowFile[];
  releaseOrigin?: {
    pullRequest: PolicyPullRequest;
    commits: PolicyCommit[];
    files: PolicyFile[];
    sourceContainsMerge: boolean;
  };
}
export interface DependencyPolicyDecision {
  allowed: boolean;
  reason: string;
  kind?: "dependency" | "release";
  subject?: string;
}
interface MetadataDependency { dependencyName: string; updateType: string }
type Manifest = Record<string, unknown>;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function manifest(text: string): Manifest | null {
  try { const value: unknown = JSON.parse(text); return record(value) ? value : null; } catch { return null; }
}
function stableVersion(value: unknown): number[] | null {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function manifestVersion(value: unknown): { operator: string; version: string } | null {
  if (typeof value !== "string") return null;
  const match = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(value);
  return match && stableVersion(match[2]) ? { operator: match[1]!, version: match[2]! } : null;
}
function safeVersionChange(before: string, after: string, classification: string): boolean {
  const from = stableVersion(before);
  const to = stableVersion(after);
  if (!from || !to || from[0] !== to[0]) return false;
  const minor = to[1]! > from[1]!;
  const patch = to[1] === from[1] && to[2]! > from[2]!;
  return (patch || minor) && !(from[0] === 0 && minor)
    && classification === `version-update:semver-${minor ? "minor" : "patch"}`;
}
function dependencyMap(value: Manifest): Record<string, string> | null {
  const result: Record<string, string> = Object.create(null);
  for (const section of DEPENDENCY_FIELDS) {
    const entries = value[section];
    if (entries === undefined) continue;
    if (!record(entries) || Object.values(entries).some((item) => typeof item !== "string")) return null;
    for (const [name, range] of Object.entries(entries)) {
      if (result[name] !== undefined && result[name] !== range) return null;
      result[name] = range as string;
    }
  }
  return result;
}
function lockedVersion(lock: unknown, name: string): string | null {
  if (!record(lock) || !record(lock.packages)) return null;
  const entry = lock.packages[name];
  if (!Array.isArray(entry) || typeof entry[0] !== "string" || !entry[0].startsWith(`${name}@`)) return null;
  const version = entry[0].slice(name.length + 1);
  return stableVersion(version) ? version : null;
}
function unchangedContract(before: Manifest, after: Manifest): boolean {
  const strip = (value: Manifest) => Object.fromEntries(Object.entries(value).filter(([key]) => !DEPENDENCY_FIELDS.some((field) => field === key)));
  if (!isDeepStrictEqual(strip(before), strip(after))) return false;
  return DEPENDENCY_FIELDS.every((section) => {
    const a = before[section];
    const b = after[section];
    if (a === undefined || b === undefined) return a === b;
    return record(a) && record(b) && isDeepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort());
  });
}
function completeSnapshot(pr: PolicyPullRequest, commits: PolicyCommit[], files: PolicyFile[]): boolean {
  return Number.isSafeInteger(pr.number) && pr.number > 0 && SHA.test(pr.head.sha) && SHA.test(pr.base.sha)
    && commits.length > 0 && commits.length === pr.commits && files.length > 0 && files.length === pr.changed_files
    && commits.at(-1)?.sha === pr.head.sha && commits.every((commit) => SHA.test(commit.sha));
}
function botCommits(commits: PolicyCommit[]): boolean {
  return commits.length > 0 && commits.every((commit) => commit.author?.login === BOT && commit.commit.verification?.verified === true);
}
function modifiedOnly(files: PolicyFile[]): boolean {
  return files.every((file) => file.status === "modified" && !file.previous_filename);
}
function parsedMetadata(value: unknown): MetadataDependency[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const names = new Set<string>();
  const result: MetadataDependency[] = [];
  for (const item of value) {
    if (!record(item) || typeof item.dependencyName !== "string" || !item.dependencyName || names.has(item.dependencyName)
      || typeof item.updateType !== "string" || !UPDATE_TYPES.includes(item.updateType)) return null;
    names.add(item.dependencyName);
    result.push({ dependencyName: item.dependencyName, updateType: item.updateType });
  }
  return result;
}

// Existing workflow lines may change only a SHA pin and its stable version comment.
// New steps, permissions, scripts, action names and inputs require human review.
function safeActionChanges(files: PolicyWorkflowFile[], metadata: MetadataDependency[]): boolean {
  const changed = new Set<string>();
  const line = /^(\s*(?:-\s*)?uses:\s*)([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)@([a-f0-9]{40})(\s+#\s*v?)(\d+(?:\.\d+){0,2})(\s*)$/;
  for (const file of files) {
    const before = file.before.split("\n");
    const after = file.after.split("\n");
    if (before.length !== after.length) return false;
    for (let index = 0; index < before.length; index++) {
      if (before[index] === after[index]) continue;
      const a = line.exec(before[index]!);
      const b = line.exec(after[index]!);
      if (!a || !b || a[1] !== b[1] || a[2] !== b[2] || a[4] !== b[4] || a[6] !== b[6] || a[3] === b[3]) return false;
      const dependency = metadata.find((item) => item.dependencyName === a[2]);
      if (!dependency) return false;
      const oldParts = a[5]!.split(".").map(Number);
      const newParts = b[5]!.split(".").map(Number);
      if (oldParts[0] !== newParts[0] || oldParts[0] === 0 || oldParts.length !== newParts.length) return false;
      if (a[5] !== b[5] && !safeVersionChange(a[5]!, b[5]!, dependency.updateType)) return false;
      changed.add(a[2]!);
    }
  }
  return changed.size > 0 && metadata.every((item) => changed.has(item.dependencyName));
}

/** Pure decision function: it performs no network requests, approvals, or merges. */
export function evaluateDependencyPolicy(input: DependencyPolicyInput): DependencyPolicyDecision {
  const deny = (reason: string): DependencyPolicyDecision => ({ allowed: false, reason });
  const { pullRequest: pr, commits, files } = input;
  if (pr.state !== "open" || pr.draft || pr.base.ref !== "main" || pr.base.repo.full_name !== input.repository
    || pr.head.repo?.full_name !== input.repository || pr.head.sha !== input.expectedHead) return deny("PR is not the expected open same-repository main-targeting head.");
  if (!completeSnapshot(pr, commits, files) || !modifiedOnly(files)) return deny("Incomplete snapshot, added/deleted files, or renamed files require manual review.");
  const before = manifest(input.basePackageJson);
  const after = manifest(input.headPackageJson);
  if (!before || !after) return deny("Invalid package manifest.");

  if (pr.user.login === BOT) {
    if (input.actor !== BOT || !botCommits(commits)) return deny("Only verified Dependabot-authored commits and CI runs are eligible.");
    const metadata = parsedMetadata(input.metadata);
    if (!metadata || metadata.some((item) => item.dependencyName === "lucide-react")) return deny("Missing safe update metadata or a deliberately pinned Lucide update.");
    if (!unchangedContract(before, after)) return deny("Package metadata, scripts, dependency membership, or peer contracts changed.");
    const packageFiles = files.every((file) => file.filename === "package.json" || file.filename === "bun.lock");
    const actionFiles = files.every((file) => /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(file.filename));
    if (!packageFiles && !actionFiles) return deny("Only manifest/lock updates or existing workflow action pins are eligible.");
    if (actionFiles) {
      if (!isDeepStrictEqual(before, after) || !input.workflowFiles || input.workflowFiles.length !== files.length
        || !files.every((file) => input.workflowFiles!.some((content) => content.filename === file.filename))
        || !safeActionChanges(input.workflowFiles, metadata)) return deny("Workflow update changes more than supported stable action pins.");
    } else {
      const oldDependencies = dependencyMap(before);
      const newDependencies = dependencyMap(after);
      if (!oldDependencies || !newDependencies) return deny("Unsupported dependency declarations.");
      for (const item of metadata) {
        // Resolve every group member from actual manifest/lock data, not release-note prose.
        const oldRange = manifestVersion(oldDependencies[item.dependencyName]);
        const newRange = manifestVersion(newDependencies[item.dependencyName]);
        const previous = input.baseLockfile === undefined ? oldRange?.version : lockedVersion(input.baseLockfile, item.dependencyName);
        const next = input.headLockfile === undefined ? newRange?.version : lockedVersion(input.headLockfile, item.dependencyName);
        if (!previous || !next || !safeVersionChange(previous, next, item.updateType)) return deny("Prerelease, major, pre-1.0 minor, downgrade, or unclassified update requires review.");
      }
      for (const [name, range] of Object.entries(oldDependencies)) {
        if (range === newDependencies[name]) continue;
        const item = metadata.find((dependency) => dependency.dependencyName === name);
        const a = manifestVersion(range);
        const b = manifestVersion(newDependencies[name]);
        if (!item || !a || !b || a.operator !== b.operator || !safeVersionChange(a.version, b.version, item.updateType)) return deny("Manifest changes do not match the verified dependency metadata.");
      }
    }
    return { allowed: true, kind: "dependency", reason: "Verified stable dependency update with a limited file and metadata scope.", subject: `fix(deps): update reviewed dependencies (#${pr.number})` };
  }

  if (!input.trustedReleaseAuthor || input.actor !== input.trustedReleaseAuthor || pr.user.login !== input.trustedReleaseAuthor
    || pr.head.ref !== "automation/dependency-release") return deny("Not a trusted dependency-release author and branch.");
  const marker = parseDependencyReleaseMarker(pr.body ?? "");
  const next = typeof before.version === "string" ? nextDependencyReleaseVersion(before.version) : null;
  const title = `chore: release @cosborn2/ui ${next}`;
  if (!marker || !next || marker.source !== pr.base.sha || marker.version !== before.version || pr.title !== title
    || after.version !== next || files.length !== 1 || files[0]!.filename !== "package.json"
    || commits.length !== 1 || commits[0]!.author?.login !== input.trustedReleaseAuthor
    || commits[0]!.committer?.login !== input.trustedReleaseAuthor
    || commits[0]!.parents.length !== 1 || commits[0]!.parents[0]!.sha !== marker.source
    || !isDeepStrictEqual(parseDependencyReleaseMarker(commits[0]!.commit.message ?? ""), marker)) return deny("Release metadata, version, author, or single-parent commit proof does not match.");
  try {
    if (replacePackageVersion(input.basePackageJson, next) !== input.headPackageJson) return deny("The release PR must change only the package version bytes.");
  } catch { return deny("The release manifest has no uniquely replaceable version."); }
  const origin = input.releaseOrigin;
  if (!origin || origin.pullRequest.number !== marker.dependencyPr || !origin.sourceContainsMerge
    || origin.pullRequest.merged !== true || origin.pullRequest.user.login !== BOT
    || origin.pullRequest.base.ref !== "main" || origin.pullRequest.base.repo.full_name !== input.repository
    || origin.pullRequest.head.repo?.full_name !== input.repository
    || !completeSnapshot(origin.pullRequest, origin.commits, origin.files) || !botCommits(origin.commits)
    || !modifiedOnly(origin.files) || !origin.files.every((file) => ["package.json", "bun.lock"].includes(file.filename))) return deny("The release has no verified merged Dependabot origin in its source history.");
  return { allowed: true, kind: "release", reason: "Verified next-version-only release of merged dependency changes.", subject: `${title} (#${pr.number})` };
}

interface VerificationRun {
  id: number;
  name: string;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  actor: { login: string };
  head_repository: { full_name: string };
  pull_requests: { number: number }[];
}

export function isSuccessfulVerification(run: VerificationRun, repository: string, head: string): boolean {
  return run.name === "UI Package" && run.path === ".github/workflows/ui-package.yml"
    && run.event === "pull_request" && run.status === "completed" && run.conclusion === "success"
    && SHA.test(head) && run.head_sha === head && run.head_repository.full_name === repository;
}

// CLI adapter reads GitHub metadata and immutable blobs only. Approval is a
// separate workflow step; this module never writes reviews, branches or merges.
function github<T>(endpoint: string, paginate = false): T {
  const args = ["api", endpoint, ...(paginate ? ["--paginate", "--slurp"] : [])];
  const value: unknown = JSON.parse(execFileSync("gh", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  return (paginate ? (value as unknown[][]).flat() : value) as T;
}
function content(repository: string, path: string, ref: string): string {
  if (!SHA.test(ref)) throw new Error("Invalid immutable content reference.");
  const value = github<{ type: string; encoding: string; content: string }>(`repos/${repository}/contents/${path}?ref=${ref}`);
  if (value.type !== "file" || value.encoding !== "base64") throw new Error(`Unsupported content response for ${path}.`);
  return Buffer.from(value.content, "base64").toString("utf8");
}
function metadataFromCommits(commits: PolicyCommit[]): MetadataDependency[] {
  if (!botCommits(commits)) return [];
  const updates = new Map<string, MetadataDependency>();
  for (const commit of commits) {
    const blocks = [...(commit.commit.message ?? "").matchAll(/^---\r?\n([\s\S]*?)^\.\.\.\s*$/gm)];
    if (blocks.length !== 1) return [];
    const block: unknown = Bun.YAML.parse(blocks[0]![1]!);
    if (!record(block) || !Array.isArray(block["updated-dependencies"])) return [];
    for (const entry of block["updated-dependencies"]) {
      if (!record(entry) || typeof entry["dependency-name"] !== "string" || typeof entry["update-type"] !== "string"
        || !UPDATE_TYPES.includes(entry["update-type"])) return [];
      const name = entry["dependency-name"];
      const updateType = entry["update-type"];
      if (updates.get(name)?.updateType !== "version-update:semver-minor") updates.set(name, { dependencyName: name, updateType });
    }
  }
  return [...updates.values()];
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Invalid repository.");
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!, "utf8")) as {
    workflow_run?: { id: number };
    inputs?: { pull_request_number?: string | number };
  };
  let run: VerificationRun;
  let pr: PolicyPullRequest;
  if (process.env.GITHUB_EVENT_NAME === "workflow_run" && Number.isSafeInteger(event.workflow_run?.id)) {
    run = github<VerificationRun>(`repos/${repository}/actions/runs/${event.workflow_run!.id}`);
    if (!isSuccessfulVerification(run, repository, run.head_sha)) throw new Error("Only successful same-repository UI Package PR runs are eligible.");
    const related = run.pull_requests.length ? run.pull_requests
      : github<{ number: number }[]>(`repos/${repository}/commits/${run.head_sha}/pulls`, true);
    const matches = related.map((pull) => github<PolicyPullRequest>(`repos/${repository}/pulls/${pull.number}`))
      .filter((pull) => pull.state === "open" && pull.base.ref === "main" && pull.head.repo?.full_name === repository && pull.head.sha === run.head_sha);
    if (matches.length !== 1) throw new Error("No unique open PR still matches the successful CI head; do not approve stale runs.");
    pr = matches[0]!;
  } else if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch" && /^[1-9]\d*$/.test(String(event.inputs?.pull_request_number ?? ""))) {
    const number = Number(event.inputs!.pull_request_number);
    if (!Number.isSafeInteger(number)) throw new Error("Invalid PR number.");
    pr = github<PolicyPullRequest>(`repos/${repository}/pulls/${number}`);
    if (!SHA.test(pr.head.sha)) throw new Error("Invalid PR head.");
    const runs = github<{ workflow_runs: VerificationRun[] }>(`repos/${repository}/actions/workflows/ui-package.yml/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100`).workflow_runs;
    const latest = runs.find((candidate) => candidate.head_sha === pr.head.sha && candidate.event === "pull_request");
    if (!latest || !isSuccessfulVerification(latest, repository, pr.head.sha)) throw new Error("The latest UI Package PR run for this exact head must succeed first.");
    run = latest;
  } else throw new Error("Unsupported approval event.");
  if (process.env.GITHUB_EVENT_NAME === "workflow_run") {
    const runs = github<{ workflow_runs: VerificationRun[] }>(`repos/${repository}/actions/workflows/ui-package.yml/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=100`).workflow_runs;
    const latest = runs.find((candidate) => candidate.head_sha === pr.head.sha && candidate.event === "pull_request");
    if (!latest || latest.id !== run.id || !isSuccessfulVerification(latest, repository, pr.head.sha)) throw new Error("A newer or incomplete verification supersedes this run; do not approve stale results.");
  }
  const jobs = github<{ jobs: { name: string; conclusion: string | null }[] }>(`repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
  const verificationJobs = jobs.jobs.filter((job) => job.name === "verify");
  if (verificationJobs.length !== 1 || verificationJobs[0]!.conclusion !== "success") throw new Error("The verify job must explicitly succeed, not be skipped.");
  const endpoint = `repos/${repository}/pulls/${pr.number}`;
  const files = github<PolicyFile[]>(`${endpoint}/files`, true);
  const commits = github<PolicyCommit[]>(`${endpoint}/commits`, true);
  const packageOnly = files.every((file) => file.filename === "package.json" || file.filename === "bun.lock");
  const input: DependencyPolicyInput = {
    repository, actor: run.actor.login, expectedHead: run.head_sha, trustedReleaseAuthor: process.env.RELEASE_AUTHOR ?? "",
    pullRequest: pr, files, commits,
    basePackageJson: content(repository, "package.json", pr.base.sha), headPackageJson: content(repository, "package.json", pr.head.sha),
    metadata: pr.user.login === BOT ? metadataFromCommits(commits) : [],
    ...(pr.user.login === BOT && packageOnly ? {
      baseLockfile: Bun.JSONC.parse(content(repository, "bun.lock", pr.base.sha)),
      headLockfile: Bun.JSONC.parse(content(repository, "bun.lock", pr.head.sha)),
    } : {}),
    workflowFiles: files.filter((file) => /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(file.filename) && file.status === "modified").map((file) => ({
      filename: file.filename, before: content(repository, file.filename, pr.base.sha), after: content(repository, file.filename, pr.head.sha),
    })),
  };
  const marker = parseDependencyReleaseMarker(pr.body ?? "");
  if (pr.head.ref === "automation/dependency-release" && marker) {
    const originEndpoint = `repos/${repository}/pulls/${marker.dependencyPr}`;
    const origin = github<PolicyPullRequest>(originEndpoint);
    const comparison = origin.merge_commit_sha && SHA.test(origin.merge_commit_sha)
      ? github<{ status: string }>(`repos/${repository}/compare/${origin.merge_commit_sha}...${marker.source}`) : null;
    input.releaseOrigin = {
      pullRequest: origin, commits: github<PolicyCommit[]>(`${originEndpoint}/commits`, true), files: github<PolicyFile[]>(`${originEndpoint}/files`, true),
      sourceContainsMerge: comparison?.status === "ahead" || comparison?.status === "identical",
    };
  }
  const decision = evaluateDependencyPolicy(input);
  console.log(`${decision.allowed ? "Eligible for approval" : "Manual review required"}: ${decision.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `allowed=${decision.allowed}\nhead_sha=${pr.head.sha}\npr_number=${pr.number}\nkind=${decision.kind ?? ""}\n`);
}
