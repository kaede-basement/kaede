import "@/extendable/global-object.ts";

import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

for (const contents of ["unchanged", "replaced", "restored after mismatch"]) {
  test("local archive registration retries with contents " + contents, async () => {
    declareInstanceStates();
    Router.navigate(Routes.AddInstance);
    const directory = await mkdtemp(paths.join(tmpdir(), "kaede-pack-retry-"));

    await using cleanup = new AsyncDisposableStack;
    cleanup.defer(() => rm(directory, { "recursive": true }));
    const path = paths.join(directory, "local.mrpack");

    await writeFile(path, "first");
    mockIPC((cmd, arguments_) => {
      if (cmd === "hash_path") {
        const request = arguments_ as { "path": string; "kind": "sha256" };

        return Bun.CryptoHasher.hash(request.kind, readFileSync(request.path), "hex");
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

    const page = globalStates.pages["add-instance"];

    async function checkRefusal(count: number): Promise<void> {
      await writeFile(path, "replacement");
      button.click();
      await Bun.sleep(0);
      expect(form.root.querySelector("[role=alert]")?.textContent).toContain("Select it again");
      expect(page.importedModpack?.name).toBe("Local");
      expect(globalStates.currentPage).toBe(Routes.AddInstance);
      expect(Object.keys(instanceStates)).toEqual([]);
      expect(install).toHaveBeenCalledTimes(count);
      expect(save).toHaveBeenCalledTimes(count);
      await writeFile(path, "first");
    }

    await select();
    expect(page.importedModpack?.sha256).toBe(Bun.CryptoHasher.hash("sha256", "first", "hex"));
    if (contents === "restored after mismatch") {
      await checkRefusal(0);
      await select();
    }
    button.click();
    await failed.promise;
    expect(message.mock.calls[0]?.[0]).toContain("save instance metadata");
    if (contents === "restored after mismatch") await checkRefusal(1);
    if (contents === "replaced") await writeFile(path, "other");
    await select();
    button.click();
    await persisted.promise;
    await Bun.sleep(0);
    expect(install).toHaveBeenCalledTimes(contents === "unchanged" ? 1 : 2);
    const installed = install.mock.lastCall![0].instanceId;

    expect(Object.keys(instanceStates)).toEqual([installed]);
    expect(globalStates.selected.currentInstance).toBe(installed);
    expect(globalStates.currentPage).toBe(Routes.Home);
    expect(save).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(contents === "restored after mismatch" ? 3 : 2);
    expect(peek).toHaveBeenCalledTimes(open.mock.calls.length);
  });
}
