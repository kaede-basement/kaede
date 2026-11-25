import { expect, mock, spyOn, test } from "bun:test";

import FileManager from "@/lib/file-manager";
import Hooks from "@/lib/hooks";
import Network from "@/lib/network";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import * as extraction from "../optifine/extract-launchwrapper.ts";
import * as inspection from "../optifine/inspect-optifine-jar.ts";
import { downloadAssets } from "./download-assets.ts";
import { downloadClient } from "./download-client.ts";
import { downloadLibraries } from "./download-libraries.ts";
import { downloadLogging } from "./download-logging.ts";
import { downloadMissing } from "./download-missing.ts";
import { settleDownloadStages } from "./settle-download-stages.ts";

// Other tests may have already replaced a public library with a partial implementation.
function override<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): Disposable {
  const original = Object.getOwnPropertyDescriptor(target, key);

  Object.defineProperty(target, key, { "configurable": true, "writable": true, value });

  return { [Symbol.dispose](): void {
    if (original) {
      Object.defineProperty(target, key, original);
    } else {
      Reflect.deleteProperty(target, key);
    }
  } };
}

test("download stages fail on incomplete reports and skip warm downloads", async () => {
  const path = "artifact";
  const artifact = { path, "url": "url", "hash": "sha1", "status": "library" };
  const finalizedPatch = {
    "assetIndex": { "id": "index", "url": "index" },
    "artifacts" : [artifact], "client"    : artifact, "logging"   : artifact,
  } as unknown as FinalizedPatchType;
  const necessaries = {
    "statuses": {}, "directories": { "assetObjects": "assets" }, "instance": { "checksum": true },
  } as PreLaunchInformationType;

  const verify = mock<typeof FileManager.verifyPaths>();

  using overrides = new DisposableStack;
  overrides.use(override(FileManager, "verifyPaths", verify));
  overrides.use(spyOn(FileManager, "join").mockImplementation((...parts) => parts.join("/")));
  overrides.use(spyOn(FileManager, "handleJsonFile").mockResolvedValue({
    "objects": { "asset": { "hash": "sha1" } },
  }));
  overrides.use(override(Hooks, "catchAsyncVoidHooks", async () => {}));
  using concurrentlyDownload = spyOn(Network, "concurrentlyDownload");

  for (const download of [downloadAssets, downloadLibraries, downloadClient, downloadLogging]) {
    for (const report of [
      { "failed": 1, "cancelled": false },
      { "failed": 0, "cancelled": true },
    ]) {
      verify.mockImplementation(async ({ paths }) => paths.map(({ path }) => path));
      concurrentlyDownload.mockResolvedValue({ ...report, "success": 0, "failures": [] });
      expect(await download({ necessaries, finalizedPatch })).toBe(false);
    }
    if (download === downloadAssets) {
      const expected = {
        "path"         : "assets/sh/sha1", "hash"         : "sha1", "shortHashPath": "assets/sh",
        "url"          : "https://resources.download.minecraft.net/sh/sha1",
      };

      expect(verify.mock.lastCall?.[0].paths[0]).toEqual(expected);
    } else {
      expect(verify.mock.lastCall?.[0].paths[0]).toBe(artifact);
    }
    verify.mockResolvedValue([]);
    concurrentlyDownload.mockClear();
    expect(await download({ necessaries, finalizedPatch })).toBe(true);
    expect(concurrentlyDownload).not.toHaveBeenCalled();
  }
  expect(verify.mock.lastCall?.[0].paths[0]).toBe(artifact);
  expect(verify).toHaveBeenLastCalledWith({
    "paths"    : [artifact],
    "algorithm": "sha1",
  });
});

test("cached OptiFine metadata restores the wrapper from the verified jar", async () => {
  const source = {
    "id": "optifine:OptiFine", "url": "remote", "path": "optifine.jar", "hash": "source-sha1",
  };
  const wrapper = {
    "id"  : "net.minecraft:launchwrapper", "url" : "", "file": "launchwrapper-of-1.jar",
    "path": "libraries/net/minecraft/launchwrapper/of-1/launchwrapper-of-1.jar", "hash": "sha1",
  };
  const necessaries = {
    "directories": { "libraries": "libraries" }, "instance": { "checksum": true }, "statuses": {},
  } as PreLaunchInformationType;
  const finalizedPatch = { "artifacts": [source, wrapper] } as unknown as FinalizedPatchType;
  const verify = mock<typeof FileManager.verifyPaths>()
    .mockResolvedValueOnce([wrapper.path])
    .mockResolvedValueOnce([]);

  using overrides = new DisposableStack;
  overrides.use(override(FileManager, "verifyPaths", verify));
  overrides.use(override(Hooks, "catchAsyncVoidHooks", async () => {}));
  using download = spyOn(Network, "concurrentlyDownload");
  using inspect = spyOn(inspection, "inspectOptiFineJar").mockResolvedValue({
    "version": "1", "entryPath": wrapper.file,
  });
  using extract = spyOn(extraction, "extractLaunchWrapper").mockResolvedValue(wrapper.path);

  expect(await downloadLibraries({ necessaries, finalizedPatch })).toBe(true);
  expect(verify.mock.calls[0][0].paths).toEqual([source, wrapper]);
  expect(verify.mock.calls[0][0].paths[1]).toBe(wrapper);
  expect(inspect.mock.calls[0][0].jarPath).toBe(source.path);
  expect(extract.mock.calls[0][0].bundled.entryPath).toBe(wrapper.file);
  expect(verify).toHaveBeenLastCalledWith({ "paths": [wrapper], "algorithm": "sha1" });
  expect(download).not.toHaveBeenCalled();
});

test("a failed sibling cancels a client still verifying its jar", async () => {
  const artifact = { "path": "game.jar", "url": "remote", "hash": "sha1" };
  const finalizedPatch = { "client": artifact } as FinalizedPatchType;
  const necessaries = {
    "statuses": {}, "instance": { "checksum": true },
  } as PreLaunchInformationType;
  let started!: () => void;
  const verifying = new Promise<void>(resolve => {
    started = resolve;
  });
  let publish!: (paths: Array<string>) => void;
  const pending = new Promise<Array<string>>(resolve => {
    publish = resolve;
  });

  using overrides = new DisposableStack;
  overrides.use(override(FileManager, "verifyPaths", () => {
    started();

    return pending;
  }));
  using network = spyOn(Network, "concurrentlyDownload");
  const cancel = async (): Promise<boolean> => {
    publish([artifact.path]);

    return true;
  };

  expect(await settleDownloadStages(cancel, [
    (signal): Promise<boolean> => downloadClient({ signal, finalizedPatch, necessaries }),
    async (): Promise<boolean> => {
      await verifying;

      return false;
    },
  ])).toBe(false);
  expect(network).not.toHaveBeenCalled();
});

test("first downloads carry hashes and sizes even with warm-path checksums disabled", async () => {
  const entries = [
    { "path": "one", "url": "first", "hash": "A".repeat(40), "size": 42 },
    { "path": "two", "url": "second", "hash": "ignore", "size": 0 },
  ];

  using overrides = new DisposableStack;
  overrides.use(override(FileManager, "verifyPaths", async () => ["one", "two"]));
  using download = spyOn(Network, "concurrentlyDownload").mockResolvedValue({
    "failed": 0, "success": 2, "cancelled": false, "failures": [],
  });
  await downloadMissing({
    entries, "checksum"   : false, "concurrency": 2, "label"      : "test",
    "statuses"   : {} as PreLaunchInformationType["statuses"],
  });
  expect(download.mock.calls[0][0].entries).toEqual([
    { ...entries[0], "algorithm": "sha1" },
    { "path": "two", "url": "second", "size": 0 },
  ]);
});
