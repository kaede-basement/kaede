import "@/extendable/global-object.ts";

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import paths from "node:path";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { expect, spyOn, test } from "bun:test";

import { LaunchStatesContextKey } from "@/constants/application.ts";
import { Routes } from "@/constants/routes.ts";
import Modrinth from "@/lib/modrinth";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

for (const changed of [true, false]) {
  test("retry of a reselected local archive checks its contents, changed=" + changed, async () => {
    declareInstanceStates();
    Router.navigate(Routes.AddInstance);
    const directory = await mkdtemp(paths.join(tmpdir(), "kaede-pack-retry-"));

    await using cleanup = new AsyncDisposableStack;
    cleanup.defer(() => rm(directory, { "recursive": true }));
    const path = paths.join(directory, "local.mrpack");

    await writeFile(path, "first");
    mockIPC(async (cmd, arguments_) => {
      if (cmd === "hash_path") {
        const request = arguments_ as { "path": string; "kind": "sha256" };

        return Bun.CryptoHasher.hash(request.kind, await readFile(request.path), "hex");
      }
    });
    const manifest = {
      "formatVersion": 1,
      "versionId"    : "1",
      "name"         : "Local",
      "files"        : [],
      "dependencies" : { "minecraft": "1.21" },
      "overrides"    : 1,
      "summary"      : null,
    };

    using open = spyOn(dialog, "open").mockResolvedValue(path);
    using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
    const failed = Promise.withResolvers<void>();
    const persisted = Promise.withResolvers<void>();

    using save = spyOn(fs, "writeTextFile").mockRejectedValueOnce(new Error("disk full"))
      .mockImplementation(async () => {
        persisted.resolve();
      });
    using message = spyOn(dialog, "message").mockImplementation(async () => {
      failed.resolve();

      return "Ok";
    });
    using install = spyOn(Modrinth, "installMrpack").mockResolvedValue(manifest);
    using picker = await mountComponent("add-instance/sections/ImportModpack");
    using form = await mountComponent("add-instance/sections/CreateInstance", {}, app => {
      app.provide(LaunchStatesContextKey, {});
    });
    const select = Reflect.get(picker.root.querySelector("test-child")!, "on-click");
    const button = form.root.querySelector("button")!;

    await select();
    button.click();
    await failed.promise;
    expect(message.mock.calls[0]?.[0]).toContain("save instance metadata");
    if (changed) await writeFile(path, "other");
    await select();
    button.click();
    await persisted.promise;
    await Bun.sleep(0);
    expect(install).toHaveBeenCalledTimes(changed ? 2 : 1);
    const installed = install.mock.lastCall![0].instanceId;

    expect(Object.keys(instanceStates)).toEqual([installed]);
    expect(globalStates.selected.currentInstance).toBe(installed);
    expect(globalStates.currentPage).toBe(Routes.Home);
    expect(save).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(2);
    expect(peek).toHaveBeenCalledTimes(2);
  });
}
