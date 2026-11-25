import { expect, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import * as cache from "@/lib/cache";
import { cache as cacheFixture, encode } from "@/lib/cache/cache-fixture.ts";
import * as paths from "@/lib/file-manager/path.ts";
import Hooks from "@/lib/hooks";
import { fetchAllVersions } from "@/lib/launcher/scopes/fetching/fetch-all-versions.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { resolvePatch } from "./resolve-patch.ts";
import { resolveVersionDocument } from "./resolve-patch-version.ts";

const version = {
  "version": "1", "sha256": "a".repeat(64), "releaseTime": "2024-01-01", "recommended": true,
};

test("index resolution pins the digest and explicit versions bypass the index", async () => {
  const { sha256 } = version;
  const necessaries = {
    "statuses": {}, "directories": { "base": "base" }, "user": {},
  } as PreLaunchInformationType;

  using hooks = spyOn(Hooks, "catchAsyncResponseHooks").mockResolvedValue("continue");
  type Options = Parameters<typeof cache.cachedMetadata>[0];

  using cached = spyOn(cache, "cachedMetadata").mockImplementation(async (options: Options) => {
    if (options.relativePath !== "net.minecraft.json") throw new Error("offline");
    const data = { "versions": [{ ...version, "sha256": sha256.toUpperCase() }] };

    expect(options.validate?.(data)).toBe(true);

    const hash = { "kind": "sha256", "sum": sha256 } as const;

    return { data, "bytes": (new Uint8Array), hash };
  });

  expect(await resolvePatch({ necessaries, "metadata": { "uid": "net.minecraft" } })).toBe(false);
  expect(cached.mock.calls.map(([request]) => request.relativePath)).toEqual([
    "net.minecraft.json", "net.minecraft/1.json",
  ]);
  expect(cached.mock.lastCall?.[0].expectedHash).toEqual({ "kind": "sha256", "sum": sha256 });
  expect(necessaries.statuses.current).toBe(LaunchStatus.PatchMetadata.FailedToFetch);
  cached.mockClear();
  expect(await resolvePatch({ necessaries, "metadata": { "uid": "net.minecraft", "equals": "2" } }))
    .toBe(false);
  expect(cached.mock.calls.map(([request]) => request.relativePath))
    .toEqual(["net.minecraft/2.json"]);
  expect(cached.mock.lastCall?.[0].expectedHash).toBeUndefined();
  expect(hooks).toHaveBeenCalled();
});

test("legacy package indexes resolve offline and refresh on the next online launch", async () => {
  using c = cacheFixture();
  const necessaries = {
    "statuses": {}, "directories": { "base": c.request.baseDirectory }, "user": {},
  } as PreLaunchInformationType;
  const request = { necessaries, "metadata": { "uid": "net.minecraft" } } as const;

  c.files.set(c.root + "net.minecraft.json", encode(JSON.stringify({ "versions": [version] })));
  c.fetch.mockRejectedValueOnce(new Error("offline"));
  expect(await resolveVersionDocument(request)).toEqual(version);
  const latest = { ...version, "version": "2", "sha256": "b".repeat(64) };

  c.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ "versions": [latest] })));
  expect(await resolveVersionDocument(request)).toEqual(latest);
  expect(c.fetch).toHaveBeenCalledTimes(2);
});

test("launcher and picker both reject an unsafe second row in the shared index", async () => {
  using c = cacheFixture();
  using base = spyOn(paths, "getBaseDirectory").mockReturnValue(c.request.baseDirectory);
  const uid = "net.minecraft";
  const necessaries = {
    "statuses": {}, "directories": { "base": c.request.baseDirectory }, "user": {},
  } as PreLaunchInformationType;
  const request = { necessaries, "metadata": { uid } } as const;
  const invalid = { "versions": [version, { ...version, "version": "a/b" }] };

  c.fetch.mockImplementation(async () => Response.json(invalid));
  const rejectBoth = async (): Promise<void> => {
    expect(await resolveVersionDocument(request)).toBe(false);
    expect(necessaries.statuses.current).toBe(LaunchStatus.PatchIndex.FailedToValidate);
    await expect(fetchAllVersions(uid)).rejects.toThrow("Invalid metadata");
  };

  await rejectBoth();
  expect(c.files.size).toBe(0);
  // Seed an indexed copy written by the earlier first-row validator.
  const url = c.fetch.mock.lastCall![0];

  await cache.cachedMetadata({ ...c.request, url, "relativePath": uid + ".json" });
  c.fetch.mockClear();
  await rejectBoth();
  expect(c.fetch).toHaveBeenCalledTimes(2);
  expect(base).toHaveBeenCalled();
});
