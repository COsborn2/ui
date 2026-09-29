// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { affectsPackage, nextRelease, readPolicy, releaseChannel, type ReleasePolicy } from "../scripts/release-policy.js";

const beta: ReleasePolicy = { line: "0.1", channel: "beta" };
const stable: ReleasePolicy = { line: "0.1", channel: "stable" };

describe("release configuration", () => {
  test("the committed release policy is valid", () => {
    const value: unknown = JSON.parse(readFileSync(new URL("../release.json", import.meta.url), "utf8"));
    expect(readPolicy(value)).toEqual(value);
  });

  test.each([beta, stable, { line: "1.0", channel: "stable" }])("accepts a release line and channel: %j", policy => {
    expect(readPolicy(policy)).toEqual(policy);
  });

  test.each([
    null, [], {}, { line: "0.1" }, { channel: "beta" },
    { line: "0.1.0", channel: "beta" }, { line: "v0.1", channel: "beta" },
    { line: "00.1", channel: "beta" }, { line: "0.01", channel: "beta" },
    { line: "0.1\n", channel: "beta" }, { line: "0.1", channel: "latest" },
    { line: "0.1", channel: ["beta"] }, { line: "0.1", channel: null },
    { line: "0.1", channel: "beta", version: "0.1.0-beta.5" },
  ])("rejects malformed or ambiguous release intent: %j", value => {
    expect(() => readPolicy(value)).toThrow();
  });
});

describe("the single maintained release line", () => {
  test("runs beta, promotion, automatic patches, then the next minor without a separate counter", () => {
    let version = "0.1.0-beta.0";
    version = nextRelease(beta, version, ["src/modal.tsx"])!;
    expect(version).toBe("0.1.0-beta.1");
    expect(releaseChannel(version)).toBe("beta");

    version = nextRelease(stable, version, ["release.json"])!;
    expect(version).toBe("0.1.0");
    expect(releaseChannel(version)).toBe("latest");

    version = nextRelease(stable, version, ["package.json", "bun.lock"])!;
    expect(version).toBe("0.1.1");

    const nextLine: ReleasePolicy = { line: "0.2", channel: "stable" };
    version = nextRelease(nextLine, version, ["release.json"])!;
    expect(version).toBe("0.2.0");
    version = nextRelease(nextLine, version, ["src/button.tsx"])!;
    expect(version).toBe("0.2.1");
    expect(() => nextRelease(stable, version, ["bun.lock"])).toThrow("older release line");
  });

  test("continues the published beta number, including double digits", () => {
    expect(nextRelease(beta, "0.1.0-beta.9", ["bun.lock"])).toBe("0.1.0-beta.10");
  });

  test("promotes the beta to stable even when no package files changed", () => {
    expect(nextRelease(stable, "0.1.0-beta.12", ["release.json"])).toBe("0.1.0");
  });

  test("patches the latest published stable version without resetting the counter", () => {
    expect(nextRelease(stable, "0.1.12", ["src/modal.tsx"])).toBe("0.1.13");
  });

  test("starts a deliberate next beta line at beta zero", () => {
    expect(nextRelease({ line: "0.2", channel: "beta" }, "0.1.12", ["release.json"])).toBe("0.2.0-beta.0");
  });

  test("allows a deliberate next major line at its initial release", () => {
    expect(nextRelease({ line: "1.0", channel: "stable" }, "0.9.12", ["release.json"])).toBe("1.0.0");
  });

  test("cannot restart beta on a line already published as stable", () => {
    expect(() => nextRelease(beta, "0.1.0", ["release.json"])).toThrow("stable line cannot return to beta");
  });

  test.each([
    [{ line: "0.1", channel: "stable" }, "0.2.3"],
    [{ line: "0.3", channel: "stable" }, "0.1.3"],
    [{ line: "2.0", channel: "stable" }, "0.1.3"],
    [{ line: "1.1", channel: "stable" }, "0.9.3"],
  ] as const)("rejects a downgrade or skipped release line: %j after %s", (policy, previous) => {
    expect(() => nextRelease(policy, previous, ["release.json"])).toThrow();
  });
});

describe("release scope", () => {
  test.each([
    "src/modal.tsx", "src/internal/dialog.ts", "styles/theme.css", "styles/components/button.css",
    "package.json", "bun.lock", "tokens.json", "tsconfig.json", "scripts/build-css.ts",
  ])("publishes package changes in %s", path => {
    expect(affectsPackage(path)).toBe(true);
    expect(nextRelease(stable, "0.1.4", [path])).toBe("0.1.5");
  });

  test.each([
    "README.md", "versioning.md", "docs/components.md", "stories/button.stories.tsx", "tests/modal.test.tsx",
    ".github/workflows/ui-package.yml", ".github/workflows/publish-ui.yml", ".github/dependabot.yml",
    "scripts/dependency-policy.ts", "release.json",
  ])("does not publish an unchanged release policy for maintenance in %s", path => {
    expect(affectsPackage(path)).toBe(false);
    expect(nextRelease(beta, "0.1.0-beta.4", [path])).toBeNull();
    expect(nextRelease(stable, "0.1.4", [path])).toBeNull();
  });

  test("does not publish when nothing changed", () => {
    expect(nextRelease(stable, "0.1.4", [])).toBeNull();
  });

  test("does publish a package fix alongside documentation or workflow updates", () => {
    expect(nextRelease(stable, "0.1.4", ["README.md", ".github/workflows/ui-package.yml", "src/button.tsx"])).toBe("0.1.5");
  });
});

describe("npm distribution channels", () => {
  test.each([["0.1.0-beta.0", "beta"], ["0.2.0-beta.15", "beta"], ["0.1.0", "latest"], ["1.2.3", "latest"]])(
    "%s publishes through %s", (version, channel) => {
      expect(releaseChannel(version)).toBe(channel);
    },
  );

  test.each(["latest", "v0.1.0", "0.1", "01.1.0", "0.1.0-alpha.1", "0.1.0-beta", "0.1.0-beta.01", "0.1.0+build.1", "0.1.0\n"])(
    "rejects an unsupported or ambiguous published version: %j", version => {
      expect(() => releaseChannel(version)).toThrow();
      expect(() => nextRelease(stable, version, ["src/button.tsx"])).toThrow();
    },
  );
});
