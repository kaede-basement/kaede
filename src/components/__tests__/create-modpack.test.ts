import "@/extendable/global-object.ts";

import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { expect, spyOn, test } from "bun:test";

import { LaunchStatesContextKey } from "@/constants/application.ts";
import { Patches } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import Modrinth from "@/lib/modrinth";
import { releaseArchive, reserveImportArchive } from "@/lib/modrinth/import-archive.ts";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

test("Minecraft-only import replaces Fabric and metadata retry keeps the install and archive",
  async () => {
    declareInstanceStates();
    Router.navigate(Routes.AddInstance);
    const page = globalStates.pages["add-instance"];
    const path = "cached.mrpack";
    const manifest = {
      "name"         : "Vanilla",
      "versionId"    : "1",
      "files"        : [],
      "dependencies" : { "minecraft": "1.21" },
      "formatVersion": 1,
      "overrides"    : 0,
      "summary"      : null,
    };

    using write = spyOn(fs, "writeTextFile").mockResolvedValue();
    using remove = spyOn(fs, "remove").mockResolvedValue();
    using install = spyOn(Modrinth, "installMrpack").mockResolvedValue(manifest);
    using message = spyOn(dialog, "message").mockResolvedValue("Ok");
    page.instanceVersionSearch = { "patch": Patches.FabricLoader, "input": "fabric" };
    await reserveImportArchive(path);
    Modrinth.applyManifest({ manifest, path });
    releaseArchive(path);
    expect(page.instanceVersionSearch).toEqual({ "patch": Patches.Minecraft, "input": "" });
    expect(page.importedModpack?.loader).toBe(Patches.Minecraft);
    write.mockRejectedValueOnce(new Error("disk full"));
    using view = await mountComponent("add-instance/sections/CreateInstance", {}, app => {
      app.provide(LaunchStatesContextKey, {});
    });
    const button = view.root.querySelector("button")!;

    button.click();
    await Bun.sleep(0);
    expect(install).toHaveBeenCalledTimes(1);
    expect(message.mock.calls[0]?.[0]).toContain("save instance metadata");
    expect(globalStates.currentPage).toBe(Routes.AddInstance);
    expect(globalStates.selected.currentInstance).not.toBe(install.mock.calls[0][0].instanceId);
    expect(page.importedModpack?.path).toBe(path);
    expect(remove).not.toHaveBeenCalled();
    button.click();
    await Bun.sleep(0);
    const id = globalStates.selected.currentInstance!;

    expect(install).toHaveBeenCalledTimes(1);
    expect(id).toBe(install.mock.calls[0][0].instanceId);
    expect(instanceStates[id].entry).toBe(Patches.Minecraft);
    expect(JSON.parse(write.mock.lastCall![1])[id].entry).toBe(Patches.Minecraft);
    expect(write).toHaveBeenCalledTimes(3);
    expect(Object.keys(instanceStates)).toEqual([id]);
    expect(page.importedModpack).toBeUndefined();
    expect(remove).toHaveBeenCalledWith(path);
    expect(globalStates.currentPage).toBe(Routes.Library);
  });
