import { describe, expect, mock, test } from "bun:test";
import { decideRelease, type ReleaseInput } from "../scripts/decide-release.js";

const prerelease: ReleaseInput = {
  name: "@cosborn2/ui",
  version: "0.1.0-beta.0",
  eventName: "push",
};

describe("npm release decisions", () => {
  test("an absent prerelease publishes under beta using an exact version lookup", async () => {
    const fetchRegistry = mock(async (_url: string, _init: RequestInit) => new Response(null, { status: 404 }));
    expect(await decideRelease(prerelease, fetchRegistry)).toEqual({
      version: "0.1.0-beta.0", channel: "beta", shouldPublish: true,
    });
    expect(fetchRegistry).toHaveBeenCalledTimes(1);
    expect(fetchRegistry.mock.calls[0]).toEqual([
      "https://registry.npmjs.org/%40cosborn2%2Fui/0.1.0-beta.0",
      { headers: { accept: "application/json" }, signal: expect.any(AbortSignal) },
    ]);
  });

  test("an absent stable release publishes under latest", async () => {
    expect(await decideRelease({ ...prerelease, version: "0.1.0" },
      async () => new Response(null, { status: 404 }))).toEqual({
      version: "0.1.0", channel: "latest", shouldPublish: true,
    });
  });

  test("a confirmed existing version skips publication", async () => {
    expect(await decideRelease(prerelease, async () => Response.json({
      name: prerelease.name, version: prerelease.version,
    }))).toEqual({ version: "0.1.0-beta.0", channel: "beta", shouldPublish: false });
  });

  test("manual retry validates the exact version and channel", async () => {
    expect(await decideRelease({
      ...prerelease, eventName: "workflow_dispatch", expectedVersion: prerelease.version, requestedChannel: "beta",
    }, async () => new Response(null, { status: 404 }))).toEqual({
      version: "0.1.0-beta.0", channel: "beta", shouldPublish: true,
    });
  });

  test.each([
    { expectedVersion: "0.1.0-beta.1", requestedChannel: "beta" },
    { expectedVersion: undefined, requestedChannel: "beta" },
    { expectedVersion: prerelease.version, requestedChannel: undefined },
    { expectedVersion: prerelease.version, requestedChannel: "canary" },
    { expectedVersion: prerelease.version, requestedChannel: "latest" },
    { version: "0.1.0", expectedVersion: "0.1.0", requestedChannel: "beta" },
  ])("rejects invalid manual release input before registry access: %j", async overrides => {
    const fetchRegistry = mock(async () => new Response(null, { status: 404 }));
    await expect(decideRelease({ ...prerelease, eventName: "workflow_dispatch", ...overrides }, fetchRegistry)).rejects.toThrow();
    expect(fetchRegistry).not.toHaveBeenCalled();
  });

  test.each([401, 403, 429, 500, 503])("fails on registry HTTP %i", async status => {
    await expect(decideRelease(prerelease, async () => new Response(null, { status })))
      .rejects.toThrow(`npm registry lookup failed with HTTP ${status}`);
  });

  test("fails on network errors", async () => {
    await expect(decideRelease(prerelease, async () => { throw new Error("network unavailable"); }))
      .rejects.toThrow("network unavailable");
  });

  test.each([
    null,
    {},
    { name: "different-package", version: prerelease.version },
    { name: prerelease.name, version: "0.1.0-beta.1" },
  ])("does not skip unconfirmed registry metadata: %j", async metadata => {
    await expect(decideRelease(prerelease, async () => Response.json(metadata)))
      .rejects.toThrow("npm registry returned metadata for a different package or version");
  });

  test("fails on invalid registry JSON", async () => {
    await expect(decideRelease(prerelease, async () => new Response("invalid JSON"))).rejects.toThrow();
  });

  test.each(["latest", "01.1.0", "0.1.0-beta.01", "0.1.0\nshould_publish=true"])("rejects invalid version %j", async version => {
    const fetchRegistry = mock(async () => new Response(null, { status: 404 }));
    await expect(decideRelease({ ...prerelease, version }, fetchRegistry)).rejects.toThrow("Invalid package version");
    expect(fetchRegistry).not.toHaveBeenCalled();
  });

  test("rejects events other than push or manual dispatch", async () => {
    const fetchRegistry = mock(async () => new Response(null, { status: 404 }));
    await expect(decideRelease({ ...prerelease, eventName: "pull_request" }, fetchRegistry))
      .rejects.toThrow("Unsupported release event");
    expect(fetchRegistry).not.toHaveBeenCalled();
  });
});
