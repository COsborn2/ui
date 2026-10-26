import { compare, inc, parse, valid } from "semver";

export interface ReleasePolicy {
  line: string;
  channel: "beta" | "stable";
}

export function readPolicy(value: unknown): ReleasePolicy {
  if (!value || typeof value !== "object" || !("line" in value) || !("channel" in value)
    || typeof value.line !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.line)
    || !valid(`${value.line}.0`) || typeof value.channel !== "string" || !["beta", "stable"].includes(value.channel)
    || Object.keys(value).some(key => !["line", "channel"].includes(key))) {
    throw new Error("release.json must contain only a SemVer line (for example 0.1) and channel (beta or stable).");
  }
  return value as ReleasePolicy;
}

export function releaseChannel(version: string): "beta" | "latest" {
  if (!valid(version) || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/.test(version)) {
    throw new Error(`Unsupported release version: ${version}`);
  }
  return version.includes("-") ? "beta" : "latest";
}

export function affectsPackage(path: string): boolean {
  return /^(src\/|styles\/)/.test(path)
    || ["package.json", "bun.lock", "tokens.json", "tsconfig.json", "scripts/build-css.ts"].includes(path);
}

// A release line is maintainer intent, not a counter. Published versions supply
// the counter; standard SemVer handles prerelease and patch increments.
export function nextRelease(policy: ReleasePolicy, previous: string, changedPaths: string[]): string | null {
  readPolicy(policy);
  const channel = releaseChannel(previous);
  const parsed = parse(previous)!;
  const previousLine = `${parsed.major}.${parsed.minor}.0`;
  const requestedLine = `${policy.line}.0`;
  const direction = compare(requestedLine, previousLine);
  if (direction < 0) throw new Error("Cannot return to an older release line.");
  if (direction > 0) {
    if (requestedLine !== inc(previousLine, "minor") && requestedLine !== inc(previousLine, "major")) {
      throw new Error("Start the next minor line, or the next major at .0; do not skip release lines.");
    }
    return policy.channel === "beta" ? `${requestedLine}-beta.0` : requestedLine;
  }
  if (channel === "latest" && policy.channel === "beta") {
    throw new Error("A stable line cannot return to beta. Start the next release line instead.");
  }
  if (channel === "beta" && policy.channel === "stable") return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  if (!changedPaths.some(affectsPackage)) return null;
  return inc(previous, channel === "beta" ? "prerelease" : "patch");
}
