import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ReleaseInput {
  name: string;
  version: string;
  eventName: string;
  expectedVersion?: string;
  requestedChannel?: string;
}

type RegistryFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ReleaseDecision {
  version: string;
  channel: "beta" | "latest";
  shouldPublish: boolean;
}

export async function decideRelease(input: ReleaseInput, fetchRegistry: RegistryFetch = fetch): Promise<ReleaseDecision> {
  const { name, version, eventName, expectedVersion, requestedChannel } = input;
  // Restrict values written to GitHub outputs and passed to npm to valid SemVer.
  const parsedVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!parsedVersion || parsedVersion[4]?.split(".").some(part => /^0\d+$/.test(part))) {
    throw new Error(`Invalid package version: ${version}`);
  }
  const channel = parsedVersion[4] ? "beta" : "latest";

  if (eventName === "workflow_dispatch") {
    if (expectedVersion !== version) throw new Error("Requested version differs from committed version");
    if (requestedChannel !== "beta" && requestedChannel !== "latest") {
      throw new Error("Release channel must be beta or latest");
    }
    if (requestedChannel !== channel) {
      throw new Error("Prereleases must use beta; stable releases must use latest");
    }
  } else if (eventName !== "push") {
    throw new Error(`Unsupported release event: ${eventName}`);
  }

  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  const response = await fetchRegistry(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  // A missing exact version is the only registry result that permits publication.
  if (response.status === 404) return { version, channel, shouldPublish: true };
  if (!response.ok) throw new Error(`npm registry lookup failed with HTTP ${response.status}`);

  const published: unknown = await response.json();
  if (!published || typeof published !== "object" || !("name" in published) || !("version" in published)
    || published.name !== name || published.version !== version) {
    throw new Error("npm registry returned metadata for a different package or version");
  }
  return { version, channel, shouldPublish: false };
}

if (import.meta.main) {
  const pkg = JSON.parse(await readFile(resolve(import.meta.dir, "../package.json"), "utf8"));
  const decision = await decideRelease({
    name: pkg.name,
    version: pkg.version,
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    expectedVersion: process.env.EXPECTED_VERSION,
    requestedChannel: process.env.DIST_TAG,
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for the release workflow");
  await appendFile(process.env.GITHUB_OUTPUT,
    `version=${decision.version}\nchannel=${decision.channel}\nshould_publish=${decision.shouldPublish}\n`);
  console.log(decision.shouldPublish
    ? `Will publish ${pkg.name}@${decision.version} with the ${decision.channel} tag after verification.`
    : `${pkg.name}@${decision.version} is already published; skipping release.`);
}
