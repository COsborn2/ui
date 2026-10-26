// @vitest-environment node
import { describe, expect, test } from "vitest";
import { latestPublished, verifyReleaseRecord, type PublishedVersion } from "../scripts/release.js";

const name = "@cosborn2/ui";
const source = "a".repeat(40);
const differentSource = "b".repeat(40);
const published = (version: string, gitHead: string | undefined = source): PublishedVersion => ({ name, version, ...(gitHead ? { gitHead } : {}) });
const metadata = (...versions: PublishedVersion[]) => ({ name, versions: Object.fromEntries(versions.map(version => [version.version, version])) });

describe("published npm release state", () => {
  test("chooses the highest SemVer rather than insertion order, lexical order, or dist-tags", () => {
    const result = latestPublished({
      ...metadata(published("0.1.9"), published("0.1.10"), published("0.1.8")),
      "dist-tags": { latest: "0.1.8" },
    });
    expect(result).toEqual(published("0.1.10"));
  });

  test("recognizes a newer beta line while latest still points at the previous stable line", () => {
    expect(latestPublished({
      ...metadata(published("0.1.12"), published("0.2.0-beta.10"), published("0.2.0-beta.9")),
      "dist-tags": { latest: "0.1.12", beta: "0.2.0-beta.9" },
    })).toEqual(published("0.2.0-beta.10"));
  });

  test("stable promotion sorts after every beta of that same version", () => {
    expect(latestPublished(metadata(published("0.1.0"), published("0.1.0-beta.99")))).toEqual(published("0.1.0"));
  });

  test.each([
    null, { name: "@someone/else", versions: {} }, { name },
    { name, versions: {} }, { name, versions: { invalid: published("invalid") } },
    { name, versions: { "0.1.2": { name: "@someone/else", version: "0.1.2", gitHead: source } } },
    { name, versions: { "0.1.2": published("0.1.1") } },
    { name, versions: { "0.1.2": null } },
  ])("rejects missing, wrong-package, or inconsistent registry records: %j", value => {
    expect(() => latestPublished(value)).toThrow();
  });

  test.each(["not-a-commit", source.slice(1), source.toUpperCase(), `${source}\n`, [source]].map(gitHead => ({ gitHead })))(
    "rejects a malformed source commit: %j", ({ gitHead }) => {
      expect(() => latestPublished({ name, versions: { "0.1.2": { name, version: "0.1.2", gitHead } } })).toThrow();
    },
  );

  test("fails on an unsupported newer prerelease rather than silently using an older stable version", () => {
    expect(() => latestPublished(metadata(published("0.1.0"), published("0.2.0-rc.1")))).toThrow("Unsupported release version");
  });
});

describe("Git and npm release reconciliation", () => {
  test("uses the exact published source when npm and its Git tag agree", () => {
    expect(verifyReleaseRecord(published("0.1.4"), source, ["v0.1.3", "v0.1.4"])).toBe(source);
  });

  test("recovers publication before tag creation from npm's recorded source", () => {
    expect(verifyReleaseRecord(published("0.1.4"), null, ["v0.1.3"])).toBe(source);
  });

  test("refuses a source mismatch instead of moving an existing tag", () => {
    expect(() => verifyReleaseRecord(published("0.1.4"), differentSource, ["v0.1.4"])).toThrow("does not match npm's source commit");
  });

  test("refuses to release while a Git version is ahead of the npm registry", () => {
    expect(() => verifyReleaseRecord(published("0.1.4"), source, ["v0.1.4", "v0.1.5"])).toThrow("tag is ahead of npm");
  });

  test("allows only the original untagged beta to bootstrap without inventing a source commit", () => {
    const bootstrap = { name, version: "0.1.0-beta.0" };
    expect(verifyReleaseRecord(bootstrap, null, [])).toBeNull();
    expect(() => verifyReleaseRecord(bootstrap, source, ["v0.1.0-beta.0"])).toThrow("no source commit");
    expect(() => verifyReleaseRecord(bootstrap, null, ["v0.0.1"])).toThrow("no source commit");
  });

  test("uses a recorded source even for the initial beta when one is available", () => {
    expect(verifyReleaseRecord(published("0.1.0-beta.0"), null, [])).toBe(source);
  });

  test.each(["0.1.0-beta.1", "0.1.0", "0.2.0"])("never reconstructs missing npm source history for %s", version => {
    const withoutSource = { name, version };
    expect(() => verifyReleaseRecord(withoutSource, null, [])).toThrow("no source commit");
    expect(() => verifyReleaseRecord(withoutSource, source, [`v${version}`])).toThrow("no source commit");
  });
});
