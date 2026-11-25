import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";

import { AuthOneTimeFetchContextKey, LaunchStatesContextKey } from "@/constants/application.ts";
import { CustomPatches } from "@/constants/meta.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import FileManager from "@/lib/file-manager";
import Launcher from "@/lib/launcher";
import {
  beginLaunchAttempt, CancelledDownload, downloadSucceeded,
} from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { cancelLaunchDownloads } from "@/lib/launcher/scopes/handle-launch.ts";
import Network from "@/lib/network";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

import { mountComponent } from "./mount-component.ts";
import { stallFetch } from "./stall-metadata-fetch.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

test("launch reports missing account and hydration errors, and cancels quietly", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {}, "lastLaunch": 0 } as InstanceStateType;
  const accounts: Array<AccountType> = [];
  const restore = GlobalInternals.instanceContext;

  using cleanup = new DisposableStack;
  cleanup.defer(() => GlobalInternals.instanceContext = restore);
  using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
  const list = mock().mockRejectedValueOnce(new Error("startup read failed"))
    .mockRejectedValueOnce(new Error("launch read failed"))
    .mockResolvedValue([]);

  const repair = mock().mockRejectedValueOnce("Installation cancelled")
    .mockRejectedValueOnce(new Error("Corrupt archive"));

  const nativeBatch = mock();

  mockIPC(command => {
    if (command === "concurrently_download") return nativeBatch();
    if (command === "list_processes") {
      return list();
    }
    if (command === "repair_legacy_mrpack") {
      return repair();
    }

    return null;
  });
  using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
  using view = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, accounts);
  });
  await Bun.sleep(0);
  const launch = GlobalInternals.instanceContext!.launchInstance;

  await launch("game");
  expect(notify.mock.calls[0][0]).toContain("Could not check for running instances");
  await launch("game");
  expect(notify.mock.calls[1][0]).toContain("Select or add an account");
  accounts.push({
    "msa"    : null, "profile": { "uuid": "u", "name": "player", "type": "offline" },
    "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
  });
  instanceStates.game.modpackPath = "legacy.mrpack";
  using prepare = spyOn(Launcher.Extractors, "getNecessaries").mockImplementation(input => ({
    "user"       : input.userPreferences, "statuses"   : input.statuses,
    "cancelId"   : input.instanceId + "-download",
    "directories": { "instance": "game", "libraries": "libraries" },
  } as PreLaunchInformationType));
  const { log } = await import("@/lib/logging/log.ts");
  const original = Object.getOwnPropertyDescriptor(log.templates, "json");

  Object.defineProperty(log.templates, "json", {
    "configurable": true, "value": { "contents": () => "" },
  });
  cleanup.defer(() => {
    if (original) {
      Object.defineProperty(log.templates, "json", original);
    } else {
      Reflect.deleteProperty(log.templates, "json");
    }
  });

  await Promise.all([launch("game"), launch("game")]);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledTimes(2);
  await launch("game");
  expect(notify.mock.calls[2][0]).toContain("Could not repair this modpack");
  expect(repair).toHaveBeenCalledTimes(2);
  delete instanceStates.game.modpackPath;
  const stages = Launcher.Fetching;

  using cancel = spyOn(stages, "cancelAll").mockResolvedValue(false);

  instanceStates.game.entry = CustomPatches.OptiFine;
  instanceStates.game.patchVersions[CustomPatches.OptiFine] = "1.8.9_HD_U_M5";
  {
    using cache = spyOn(FileManager, "handleJsonFile")
      .mockImplementation(({ getDefaultValue }) => getDefaultValue());
    const started = Promise.withResolvers<void>();
    const stopped = Promise.withResolvers<DownloadReportType>();

    using download = spyOn(Network, "concurrentlyDownload");

    nativeBatch.mockImplementationOnce(() => {
      started.resolve();

      return stopped.promise;
    });

    cancel.mockResolvedValueOnce(true);
    const pending = launch("game");

    await started.promise;
    const attempt = GlobalInternals.instanceContext!.launches.game;

    expect(download.mock.calls[0][0].entries[0].url).toContain("optifine/1.8.9/HD_U/M5");
    expect(await cancelLaunchDownloads(attempt)).toBe(true);
    stopped.resolve({ "cancelled": true, "success": 0, "failed": 0, "failures": [] });
    await pending;
    expect(attempt.current).toBe("general-aborted");
    expect(notify).toHaveBeenCalledTimes(3);
    expect(cache).toHaveBeenCalledTimes(1);
  }
  instanceStates.game.entry = "net.minecraft";
  for (const version of [undefined, "1.21"]) {
    if (version) instanceStates.game.patchVersions["net.minecraft"] = version;
    const entered = Promise.withResolvers<void>();

    using cache = spyOn(FileManager, "handleJsonFile")
      .mockImplementation(({ getDefaultValue }) => getDefaultValue());
    using fetch = stallFetch(entered.resolve);
    const pending = launch("game");

    await entered.promise;
    const state = GlobalInternals.instanceContext!.launches.game;

    await cancelLaunchDownloads(state);
    await pending;
    expect(state.current).toBe("general-aborted");
    expect(notify).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(cache).toHaveBeenCalledTimes(1);
  }
  const patch = {} as SpecificPatchMetaType;

  cleanup.use(spyOn(Launcher.Patches, "resolvePatch").mockResolvedValue(patch));
  cleanup.use(spyOn(Launcher.Patches, "resolveSubPatches").mockResolvedValue([]));
  cleanup.use(spyOn(Launcher.Parsers, "finalizePatches").mockReturnValue({
    "artifacts": [],
  } as unknown as FinalizedPatchType));
  for (const stage of ["downloadClient", "downloadLogging"] as const) {
    cleanup.use(spyOn(stages, stage).mockResolvedValue(true));
  }
  cleanup.use(spyOn(stages, "downloadLibraries").mockImplementation(async ({ necessaries }) => {
    necessaries.statuses.current = "libraries-success";

    return true;
  }));
  using assets = spyOn(stages, "downloadAssets").mockResolvedValue(true);
  using extract = spyOn(Launcher.Extractors, "unzipNatives")
    .mockRejectedValue(new Error("disk full"));
  const cleaning = Promise.withResolvers<void>();
  const cleaned = Promise.withResolvers<boolean>();

  cancel.mockImplementationOnce(() => {
    cleaning.resolve();

    return cleaned.promise;
  }).mockResolvedValueOnce(true);
  nativeBatch.mockReturnValueOnce(cleaned.promise.then(() => ({
    "cancelled": true, "success": 0, "failed": 0, "failures": [],
  })));
  assets.mockImplementationOnce(async ({ necessaries }) => {
    const report = await Network.concurrentlyDownload({
      "statuses"   : necessaries.statuses, "entries"    : [{ "url": "https://example.org/a", "path": "a" }],
      "label"      : "assets", "concurrency": 1,
    });

    return downloadSucceeded(report, necessaries.statuses);
  });
  const native = launch("game");

  await cleaning.promise;
  expect(await cancelLaunchDownloads(GlobalInternals.instanceContext!.launches.game)).toBe(true);
  cleaned.resolve(false);
  await native;
  expect(extract).toHaveBeenCalledTimes(1);
  expect(notify.mock.calls[3][0]).toContain("extract native libraries");

  expect(GlobalInternals.instanceContext!.launches.game.current).toBe("native-error");
  globalStates.selected.currentInstance = "game";
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

  cleanup.defer(() => {
    if (oldDocument) {
      Object.defineProperty(globalThis, "document", oldDocument);
    } else {
      Reflect.deleteProperty(globalThis, "document");
    }
  });
  using progress = await mountComponent("general/layout/LaunchProgress", {}, (app, document) => {
    Object.defineProperty(globalThis, "document", { "configurable": true, "value": document });
    app.provide(LaunchStatesContextKey, GlobalInternals.instanceContext!.launches);
  });
  expect(progress.root.querySelector("[id$=current-status]")?.textContent)
    .toContain("extract native libraries");
  using spawn = spyOn(Launcher, "spawnMinecraft");
  for (const failed of [0, 1]) {
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();

    if (failed) {
      assets.mockImplementationOnce(async ({ necessaries }) => {
        started.resolve();
        await finish.promise;

        const report = { failed, "cancelled": true, "success": 0, "failures": [] };

        return downloadSucceeded(report, necessaries.statuses);
      });
      extract.mockResolvedValue();
    } else {
      extract.mockImplementationOnce(async () => {
        started.resolve();
        await finish.promise;
      });
    }
    const launching = launch("game");

    await started.promise;
    const attempt = GlobalInternals.instanceContext!.launches.game;

    expect(await cancelLaunchDownloads(attempt)).toBe(false);
    expect(await cancelLaunchDownloads(attempt)).toBe(false);
    finish.resolve();
    await launching;
    expect(attempt.current).toBe(failed ? "artifact-error" : "general-aborted");
    expect(notify).toHaveBeenCalledTimes(4 + failed);
  }
  expect(spawn).not.toHaveBeenCalled();
  expect(watch).toHaveBeenCalledTimes(3);
  expect(instanceStates.game.lastLaunch).toBe(0);
  expect(view.root.textContent).toBe("");
});

test("Stop interrupts an uncached asset index before any artifact transfer", async () => {
  const entered = Promise.withResolvers<void>();
  const statuses = {} as PreLaunchInformationType["statuses"];
  const attempt = beginLaunchAttempt(statuses);

  using cache = spyOn(FileManager, "handleJsonFile")
    .mockImplementation(({ getDefaultValue }) => getDefaultValue());
  using fetch = stallFetch(entered.resolve);
  using download = spyOn(Network, "concurrentlyDownload");
  const pending = Launcher.Fetching.downloadAssets({
    "necessaries"   : { statuses, "directories": {} } as PreLaunchInformationType,
    "finalizedPatch": {
      "assetIndex": { "url": "https://example.org/index.json", "id": "test" },
    } as FinalizedPatchType,
    "signal": attempt.signal,
  });

  await entered.promise;
  await cancelLaunchDownloads(statuses);
  await expect(pending).rejects.toBeInstanceOf(CancelledDownload);
  expect(statuses.current).toBe("asset-index-pending-fetching");
  expect(cache).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(download).not.toHaveBeenCalled();
});
