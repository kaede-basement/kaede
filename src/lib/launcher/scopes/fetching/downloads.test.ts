import { expect, mock, spyOn, test } from "bun:test";

import * as paths from "@/lib/file-manager/path.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

const path = "artifact";
const concurrentlyDownload = mock(async () => ({ "failed": 1, "cancelled": false }));

mock.module("@/lib/network", () => ({ "default": { concurrentlyDownload } }));

const { "default": FileManager } = await import("@/lib/file-manager");

mock.module("@/lib/hooks", () => ({ "default": {
  "catchAsyncResponseHooks": async (): Promise<string> => "continue",
  "catchAsyncVoidHooks"    : async (): Promise<void> => {},
} }));
const { downloadAssets } = await import("./download-assets.ts");
const { downloadClient } = await import("./download-client.ts");
const { downloadLibraries } = await import("./download-libraries.ts");
const { downloadLogging } = await import("./download-logging.ts");

test("download stages fail on incomplete reports and skip warm downloads", async () => {
  const artifact = { path, "url": "url", "hash": "sha1", "status": "library" };
  const finalizedPatch = {
    "assetIndex": { "id": "index", "url": "index" },
    "artifacts" : [artifact], "client"    : artifact, "logging"   : artifact,
  } as unknown as FinalizedPatchType;
  const necessaries = {
    "statuses": {}, "directories": { "assetObjects": "assets" }, "instance": { "checksum": true },
  } as PreLaunchInformationType;

  using verify = spyOn(paths, "verifyPaths");
  using index = spyOn(FileManager, "handleJsonFile").mockResolvedValue({
    "objects": { "asset": { "hash": "sha1" } },
  });

  for (const download of [downloadAssets, downloadLibraries, downloadClient, downloadLogging]) {
    for (const report of [
      { "failed": 1, "cancelled": false },
      { "failed": 0, "cancelled": true },
    ]) {
      verify.mockImplementation(async ({ paths }) => paths.map(({ path }) => path));
      concurrentlyDownload.mockResolvedValue(report);
      expect(await download({ necessaries, finalizedPatch })).toBe(false);
    }
    verify.mockResolvedValue([]);
    concurrentlyDownload.mockClear();
    expect(await download({ necessaries, finalizedPatch })).toBe(true);
    expect(concurrentlyDownload).not.toHaveBeenCalled();
  }
  expect(index).toHaveBeenCalled();
  expect(verify).toHaveBeenLastCalledWith({
    "paths"    : [{ path, "hash": "sha1" }],
    "algorithm": "sha1",
  });
});
