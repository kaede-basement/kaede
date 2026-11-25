import { expect, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import * as cache from "@/lib/cache";
import Hooks from "@/lib/hooks";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { resolvePatch } from "./resolve-patch.ts";

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
