import "@/extendable/global-object.ts";

import type { Channel } from "@tauri-apps/api/core";
import { mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, expect, expectTypeOf, mock, spyOn, test } from "bun:test";
import { computed, effectScope } from "vue";

import { Patches } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import { verifyPaths } from "@/lib/file-manager/path.ts";
import { create } from "@/lib/instances/create.ts";
import Router from "@/lib/router";
import { declareGlobalStates, globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { ActiveInstall, installMrpack, repairLegacyMrpack } from "./install-mrpack.ts";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    "configurable": true, "value": { crypto, "__KAEDE__": { "states": {} } },
  });
});

afterEach(() => {
  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

test("mixed stat verification forwards string paths and zero sizes", async () => {
  const ipc = mock(() => []);

  type Verification = Parameters<typeof verifyPaths>[0];
  expectTypeOf<{ "paths": [string]; "algorithm": "sha1" }>().not.toExtend<Verification>();
  type WithoutDigest = { "paths": [{ "path": string }]; "algorithm": "sha1" };
  expectTypeOf<WithoutDigest>().not.toExtend<Verification>();

  mockIPC(ipc);
  await verifyPaths({ "paths": ["plain", { "path": "empty", "size": 0 }] });
  expect(ipc).toHaveBeenCalledWith("verify_paths", {
    "paths": ["plain", { "path": "empty", "size": 0 }],
  });
});

test("cancel requested before registration reaches Rust before installation starts", async () => {
  const prepared = Promise.withResolvers<void>();
  const calls: Array<string> = [];

  mockIPC(async cmd => {
    calls.push(cmd);
    if (cmd === "prepare_mrpack_install") {
      await prepared.promise;
    }
    if (cmd === "install_mrpack") {
      throw new Error("Installation cancelled");
    }
  });
  const installing = installMrpack({
    "archivePath": "pack", "instanceId": "id", "statuses": {} as LauncherStatusesType,
  });

  await ActiveInstall.value!.cancel();
  prepared.resolve();
  await expect(installing).rejects.toThrow("Installation cancelled");
  expect(calls).toEqual(["prepare_mrpack_install", "cancel_downloads", "install_mrpack"]);
  expect(ActiveInstall.value).toBeUndefined();
});

test("remount retains the install and its completion preserves the newer draft", async () => {
  using initialPage = spyOn(Router, "getInitialPage").mockReturnValue(Routes.AddInstance);
  declareGlobalStates();
  declareInstanceStates();
  expect(initialPage).toHaveBeenCalled();
  const prepared = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const ipc = mock(async (cmd: string) => {
    if (cmd === "repair_legacy_mrpack") {
      return "repaired";
    }
    if (cmd === "install_mrpack") {
      started.resolve();

      return prepared.promise;
    }
  });

  mockIPC(ipc);
  const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");

  Object.defineProperty(crypto, "randomUUID", { "configurable": true, "value": undefined });
  try {
    const page = globalStates.pages["add-instance"];

    page.instance = { "name": "A", "patchVersions": { "net.minecraft": "1" } } as InstanceStateType;
    page.importedModpack = { "path": "A", "name": "A", "loader": Patches.Minecraft };
    const statuses = { "downloads": { "total": 0, "success": 0 } } as LauncherStatusesType;
    const first = effectScope();
    const installing = first.run(() => create(page.instance, Patches.Minecraft, "A", async id => {
      await installMrpack({ "archivePath": "A", "instanceId": id, statuses });
    }));

    await started.promise;
    first.stop();
    const second = effectScope();
    const pending = second.run(() => computed(() => ActiveInstall.value))!;

    expect(pending.value?.instanceId).toBeTruthy();
    expect(typeof pending.value?.cancel).toBe("function");
    expect(Object.keys(instanceStates)).toEqual([]);
    await expect(installMrpack({ "archivePath": "A", "instanceId": "duplicate", statuses }))
      .rejects.toThrow("active");
    page.instance = { ...page.instance, "name": "B" };
    page.importedModpack = { ...page.importedModpack, "path": "B" };
    prepared.resolve();
    const id = await installing;

    expect(instanceStates[id!].name).toBe("A");
    expect(instanceStates[id!].modpackPath).toBeUndefined();
    expect(pending.value).toBeUndefined();
    expect(page.instance.name).toBe("B");
    expect(page.importedModpack.path).toBe("B");
    expect(globalStates.currentPage).toBe(Routes.AddInstance);
    second.stop();

    instanceStates[id!] = { ...instanceStates[id!], "modpackPath": "legacy.mrpack" };
    await repairLegacyMrpack(instanceStates[id!], id!, "minecraft", statuses);
    await repairLegacyMrpack(instanceStates[id!], id!, "minecraft", statuses);
    expect(instanceStates[id!].modpackPath).toBeUndefined();
    expect(ipc.mock.calls.filter(([cmd]) => cmd === "repair_legacy_mrpack")).toHaveLength(1);
  } finally {
    if (original) {
      Object.defineProperty(crypto, "randomUUID", original);
    } else {
      Reflect.deleteProperty(crypto, "randomUUID");
    }
  }
});

test("registration awaits the instance write and preserves an active Modrinth tab", async () => {
  using initial = spyOn(Router, "getInitialPage").mockReturnValue(Routes.AddInstance);
  declareGlobalStates();
  declareInstanceStates();
  expect(initial).toHaveBeenCalled();
  const writing = Promise.withResolvers<void>();
  const written = Promise.withResolvers<void>();

  mockIPC(async (command, data) => {
    if (command === "plugin:fs|write_text_file") {
      const text = (new TextDecoder).decode(data as Uint8Array);

      expect(Object.values(JSON.parse(text))).toHaveLength(1);
      writing.resolve();
      await written.promise;
    }
  });
  const page = globalStates.pages["add-instance"];

  page.instance = {
    "name": "Pack", "patchVersions": { "net.minecraft": "1" },
  } as InstanceStateType;
  page.importedModpack = { "path": "pack", "name": "Pack", "loader": Patches.Minecraft };
  page.tab = "clean-minecraft";
  let finished = false;
  const registered = create(page.instance, Patches.Minecraft, "pack", async () => {})!.then(id => {
    finished = true;

    return id;
  });

  await writing.promise;
  expect(finished).toBe(false);
  page.tab = "modrinth";
  written.resolve();
  const id = await registered;

  expect(instanceStates[id].name).toBe("Pack");
  expect(page.instance.name).toBe("Pack");
  expect(page.importedModpack.path).toBe("pack");
  expect(globalStates.currentPage).toBe(Routes.AddInstance);
});

test("legacy archive availability and cancellation retain the retry marker", async () => {
  declareInstanceStates();
  instanceStates.legacy = { "modpackPath": "legacy.mrpack" } as InstanceStateType;
  const statuses = { "downloads": { "total": 0, "success": 0 } } as LauncherStatusesType;
  const commands: Array<string> = [];

  for (const outcome of ["archiveUnavailable", "cancel"]) {
    mockIPC((cmd, payload) => {
      commands.push(cmd);
      const { onProgress } = payload as { "onProgress": Channel<[number, number]> };

      onProgress.onmessage([1, 4]);
      expect(statuses.downloads.total).toBe(4);
      expect(statuses.downloads.success).toBe(1);
      if (outcome === "cancel") {
        throw new Error("Installation cancelled");
      }

      return outcome;
    });
    const repairing = repairLegacyMrpack(
      instanceStates.legacy, "legacy", "minecraft", statuses,
    );

    if (outcome === "cancel") {
      await expect(repairing).rejects.toThrow("Installation cancelled");
    } else {
      expect(await repairing).toBeUndefined();
    }
    expect(instanceStates.legacy.modpackPath).toBe("legacy.mrpack");
    expect(statuses.downloads.total).toBe(0);
  }
  expect(commands).toEqual(["repair_legacy_mrpack", "repair_legacy_mrpack"]);
});
