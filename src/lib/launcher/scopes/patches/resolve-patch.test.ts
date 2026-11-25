import { expect, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import * as cache from "@/lib/cache";
import { cache as cacheFixture, encode } from "@/lib/cache/cache-fixture.ts";
import Hooks from "@/lib/hooks";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { resolvePatch } from "./resolve-patch.ts";
import { resolveVersionDocument } from "./resolve-patch-version.ts";

test("index resolution pins the digest and explicit versions bypass the index", async () => {
  const sha256 = "a".repeat(64);
  const necessaries = {
    "statuses": {}, "directories": { "base": "base" }, "user": {},
  } as PreLaunchInformationType;

  using hooks = spyOn(Hooks, "catchAsyncResponseHooks").mockResolvedValue("continue");
  using cached = spyOn(cache, "cachedMetadata").mockImplementation(async options => {
    if (options.relativePath !== "net.minecraft.json") throw new Error("offline");
    const data = { "versions": [{ "version": "1", sha256 }] };

    expect(options.validate?.(data)).toBe(true);

    return { data, "bytes": (new Uint8Array), "hash": { "kind": "sha256", "sum": sha256 } };
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
  const version = { "version": "1", "sha256": "a".repeat(64) };

  c.files.set(c.root + "net.minecraft.json", encode(JSON.stringify({ "versions": [version] })));
  c.fetch.mockRejectedValueOnce(new Error("offline"));
  expect(await resolveVersionDocument(request)).toEqual(version);
  const latest = { "version": "2", "sha256": "b".repeat(64) };

  c.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ "versions": [latest] })));
  expect(await resolveVersionDocument(request)).toEqual(latest);
  expect(c.fetch).toHaveBeenCalledTimes(2);
});
