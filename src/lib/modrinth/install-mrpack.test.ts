import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
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
    const statuses = {} as LauncherStatusesType;
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
    await repairLegacyMrpack(instanceStates[id!], id!, "minecraft");
    await repairLegacyMrpack(instanceStates[id!], id!, "minecraft");
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
