import { describe, expect, test } from "vitest";
import { evaluateDependencyPolicy, isSuccessfulVerification, type DependencyPolicyInput } from "../scripts/dependency-policy.js";

const base = "a".repeat(40);
const head = "b".repeat(40);
const repository = "COsborn2/ui";
const bot = "dependabot[bot]";
const manifest = { name: "@cosborn2/ui", version: "0.1.0-beta.0", scripts: { test: "vitest run" },
  dependencies: { example: "1.2.3" }, devDependencies: { tool: "^2.0.0" },
  peerDependencies: { react: "^19.0.0" }, sideEffects: ["**/*.css"], license: "MIT" };
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

function dependency(): DependencyPolicyInput {
  return {
    repository, actor: bot, expectedHead: head,
    pullRequest: { number: 42, title: "Bump example [skip ci]", body: "Upstream release notes", state: "open", draft: false,
      user: { login: bot }, base: { ref: "main", sha: base, repo: { full_name: repository } },
      head: { ref: "dependabot/bun/example", sha: head, repo: { full_name: repository } }, commits: 1, changed_files: 2 },
    commits: [{ sha: head, author: { login: bot }, commit: { verification: { verified: true } } }],
    files: [{ filename: "package.json", status: "modified" }, { filename: "bun.lock", status: "modified" }],
    basePackageJson: json(manifest), headPackageJson: json({ ...manifest, dependencies: { example: "1.2.4" } }),
    baseLockfile: { packages: { example: ["example@1.2.3"] } }, headLockfile: { packages: { example: ["example@1.2.4"] } },
    metadata: [{ dependencyName: "example", updateType: "version-update:semver-patch" }],
  };
}
function changePackage(input: DependencyPolicyInput, field: string, value: unknown) {
  input.headPackageJson = json({ ...JSON.parse(input.headPackageJson), [field]: value });
}
function actions(): DependencyPolicyInput {
  const input = dependency();
  input.files = [{ filename: ".github/workflows/ui-package.yml", status: "modified" }];
  input.pullRequest.changed_files = 1;
  input.headPackageJson = input.basePackageJson;
  input.metadata = [{ dependencyName: "actions/checkout", updateType: "version-update:semver-patch" }];
  input.workflowFiles = [{ filename: input.files[0]!.filename,
    before: `jobs:\n  verify:\n    steps:\n      - uses: actions/checkout@${base} # v4\n      - run: bun test\n`,
    after: `jobs:\n  verify:\n    steps:\n      - uses: actions/checkout@${head} # v4\n      - run: bun test\n` }];
  return input;
}
describe("dependency approval policy", () => {
  test("accepts a verified patch and supplies controlled squash text", () => {
    const result = evaluateDependencyPolicy(dependency());
    expect(result).toMatchObject({ allowed: true, kind: "dependency", subject: "fix(deps): update reviewed dependencies (#42)" });
    expect(result.subject).not.toContain("skip ci");
  });

  test("does not give the former generated release branch an approval exception", () => {
    const input = dependency();
    input.actor = "COsborn2";
    input.pullRequest.user.login = "COsborn2";
    input.pullRequest.head.ref = "automation/dependency-release";
    input.pullRequest.title = "chore: release @cosborn2/ui 0.1.0-beta.1";
    input.headPackageJson = json({ ...manifest, version: "0.1.0-beta.1" });
    input.commits[0]!.author = { login: "COsborn2" };
    expect(evaluateDependencyPolicy(input).allowed).toBe(false);
  });

  test("accepts stable grouped minor/patch updates using actual locked versions", () => {
    const input = dependency();
    input.headPackageJson = json({ ...JSON.parse(input.headPackageJson), devDependencies: { tool: "^2.1.0" } });
    input.baseLockfile = { packages: { example: ["example@1.2.3"], tool: ["tool@2.0.0"] } };
    input.headLockfile = { packages: { example: ["example@1.2.4"], tool: ["tool@2.1.0"] } };
    input.metadata = [{ dependencyName: "example", updateType: "version-update:semver-patch" }, { dependencyName: "tool", updateType: "version-update:semver-minor" }];
    expect(evaluateDependencyPolicy(input).allowed).toBe(true);
  });

  test("accepts lock-only patches without guessing a version from the manifest range", () => {
    const input = dependency();
    input.headPackageJson = input.basePackageJson;
    input.files = [{ filename: "bun.lock", status: "modified" }];
    input.pullRequest.changed_files = 1;
    expect(evaluateDependencyPolicy(input).allowed).toBe(true);
  });

  const refused: [string, (input: DependencyPolicyInput) => void][] = [
    ["fork", (x) => { x.pullRequest.head.repo = { full_name: "outside/ui" }; }],
    ["different base", (x) => { x.pullRequest.base.ref = "release"; }],
    ["stale head", (x) => { x.expectedHead = "c".repeat(40); }],
    ["draft", (x) => { x.pullRequest.draft = true; }],
    ["human actor", (x) => { x.actor = "COsborn2"; }],
    ["human PR author", (x) => { x.pullRequest.user.login = "COsborn2"; }],
    ["human commit", (x) => { x.commits[0]!.author = { login: "COsborn2" }; }],
    ["unsigned commit", (x) => { x.commits[0]!.commit.verification = { verified: false }; }],
    ["truncated commit list", (x) => { x.pullRequest.commits = 2; }],
    ["truncated file list", (x) => { x.pullRequest.changed_files = 3; }],
    ["source edit", (x) => { x.files[0]!.filename = "src/button.tsx"; }],
    ["new file", (x) => { x.files[0]!.status = "added"; }],
    ["renamed file", (x) => { x.files[0]!.previous_filename = "old-package.json"; }],
    ["nested manifest", (x) => { x.files[0]!.filename = "examples/package.json"; }],
    ["script edit", (x) => changePackage(x, "scripts", { test: "echo passed" })],
    ["peer contract change", (x) => changePackage(x, "peerDependencies", { react: "^20.0.0" })],
    ["sideEffects change", (x) => changePackage(x, "sideEffects", false)],
    ["version change", (x) => changePackage(x, "version", "0.1.0-beta.1")],
    ["new dependency", (x) => changePackage(x, "dependencies", { example: "1.2.4", unexpected: "1.0.0" })],
    ["URL dependency", (x) => changePackage(x, "dependencies", { example: "https://example.com/archive.tgz" })],
    ["range contract change", (x) => changePackage(x, "dependencies", { example: "^1.2.4" })],
    ["missing metadata", (x) => { x.metadata = []; }],
    ["duplicate metadata", (x) => { x.metadata = [...x.metadata as unknown[], ...x.metadata as unknown[]]; }],
    ["major metadata", (x) => { x.metadata = [{ dependencyName: "example", updateType: "version-update:semver-major" }]; }],
    ["misclassified metadata", (x) => { x.metadata = [{ dependencyName: "example", updateType: "version-update:semver-minor" }]; }],
    ["Lucide", (x) => { x.metadata = [{ dependencyName: "lucide-react", updateType: "version-update:semver-patch" }]; }],
    ["unclassified group member", (x) => { x.metadata = [...x.metadata as unknown[], { dependencyName: "tool", updateType: "" }]; }],
    ["missing locked member", (x) => { x.headLockfile = { packages: {} }; }],
    ["prerelease lock", (x) => { x.headLockfile = { packages: { example: ["example@1.2.4-beta.1"] } }; }],
    ["major lock", (x) => { x.headLockfile = { packages: { example: ["example@2.0.0"] } }; }],
    ["downgrade lock", (x) => { x.headLockfile = { packages: { example: ["example@1.2.2"] } }; }],
  ];
  test.each(refused)("requires manual review for %s", (_label, alter) => {
    const input = dependency(); alter(input); expect(evaluateDependencyPolicy(input).allowed).toBe(false);
  });

  test.each([["0.2.3", "0.2.4", "patch", true], ["0.2.3", "0.3.0", "minor", false]])("treats pre-1.0 update %s -> %s conservatively", (from, to, kind, allowed) => {
    const input = dependency();
    input.basePackageJson = json({ ...manifest, dependencies: { example: from } });
    input.headPackageJson = json({ ...manifest, dependencies: { example: to } });
    input.baseLockfile = { packages: { example: [`example@${from}`] } };
    input.headLockfile = { packages: { example: [`example@${to}`] } };
    input.metadata = [{ dependencyName: "example", updateType: `version-update:semver-${kind}` }];
    expect(evaluateDependencyPolicy(input).allowed).toBe(allowed);
  });
});

describe("GitHub Actions dependency policy", () => {
  test("accepts a SHA-only update with a CI-only squash subject that does not trigger an npm release", () => {
    expect(evaluateDependencyPolicy(actions())).toMatchObject({ allowed: true, kind: "dependency", subject: "chore(ci): update reviewed actions (#42)" });
  });
  test.each([
    ["command injection", (text: string) => text.replace("bun test", "echo passed")],
    ["unpinning", (text: string) => text.replace(head, "v4")],
    ["new action", (text: string) => text.replace("actions/checkout", "other/action")],
    ["major action", (text: string) => text.replace("# v4", "# v5")],
    ["prerelease tag", (text: string) => text.replace("# v4", "# v4.1.0-beta.1")],
    ["new step", (text: string) => text + "      - run: echo extra\n"],
  ])("requires review for %s", (_label, alter) => {
    const input = actions(); input.workflowFiles![0]!.after = alter(input.workflowFiles![0]!.after);
    expect(evaluateDependencyPolicy(input).allowed).toBe(false);
  });
});

describe("verification run binding", () => {
  const run = { id: 12, name: "UI Package", path: ".github/workflows/ui-package.yml", event: "pull_request", status: "completed", conclusion: "success",
    head_sha: head, actor: { login: bot }, head_repository: { full_name: repository }, pull_requests: [{ number: 42 }] };
  test("accepts successful trusted CI for the exact immutable head", () => {
    expect(isSuccessfulVerification(run, repository, head)).toBe(true);
    expect(isSuccessfulVerification(run, repository, base)).toBe(false);
  });
  test.each([
    { name: "Unrelated checks" }, { path: ".github/workflows/other.yml" }, { event: "push" },
    { status: "in_progress" }, { conclusion: "failure" }, { conclusion: "skipped" },
    { head_repository: { full_name: "outside/ui" } },
  ])("rejects unrelated, incomplete, failed, or fork CI (%j)", (change) => {
    expect(isSuccessfulVerification({ ...run, ...change }, repository, head)).toBe(false);
  });
});
