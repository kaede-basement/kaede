import "@/extendable/global-object.ts";

import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import paths from "node:path";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";

import { LaunchStatesContextKey } from "@/constants/application.ts";
import { Patches } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import FileManager from "@/lib/file-manager";
import { createFromDraft } from "@/lib/instances/create.ts";
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

    using base = spyOn(FileManager, "getBaseDirectory").mockReturnValue(directory);

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
    expect(install).toHaveBeenCalledTimes(contents === "replaced" ? 2 : 1);
    const installed = install.mock.lastCall![0].instanceId;

    if (contents !== "replaced") expect(installed).toBe(install.mock.calls[0][0].instanceId);
    expect(Object.keys(instanceStates)).toEqual([installed]);
    expect(globalStates.selected.currentInstance).toBe(installed);
    expect(globalStates.currentPage).toBe(Routes.Home);
    expect(save).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledTimes(contents === "restored after mismatch" ? 3 : 2);
    expect(peek).toHaveBeenCalledTimes(open.mock.calls.length);
    expect(base).toHaveBeenCalled();
  });
}

for (const different of ["archive contents", "base directory"]) {
  test("A → B → A retains both pending installs with different " + different, async () => {
    declareInstanceStates();
    const page = globalStates.pages["add-instance"];
    let digest: string;

    mockIPC(command => (command === "hash_path" ? digest : undefined));
    using base = spyOn(FileManager, "getBaseDirectory");
    using save = spyOn(fs, "writeTextFile").mockRejectedValueOnce(new Error("disk full"))
      .mockRejectedValueOnce(new Error("disk full"))
      .mockResolvedValue();
    const install = mock<(id: string) => Promise<void>>().mockResolvedValue();

    function submit(name: "A" | "B", path = "selected.mrpack"): Promise<string> {
      base.mockReturnValue(different === "base directory" ? "/test/" + name : "/test/shared");
      const contents = different === "archive contents" ? name : "same pack";

      digest = Bun.CryptoHasher.hash("sha256", contents, "hex");
      page.instance = {
        name, "patchVersions": { "net.minecraft": "1.21" },
      } as NonNullable<typeof page.instance>;
      page.importedModpack = { name, path, "sha256": digest, "loader": Patches.Minecraft };

      return createFromDraft(page.instance, Patches.Minecraft, { path, install });
    }

    await expect(submit("A")).rejects.toThrow("save instance metadata");
    await expect(submit("B")).rejects.toThrow("save instance metadata");
    expect(install).toHaveBeenCalledTimes(2);
    const [[idA], [idB]] = install.mock.calls;

    expect(idA).not.toBe(idB);
    expect(await submit("A", "renamed.mrpack")).toBe(idA);
    expect(await submit("B")).toBe(idB);
    expect(install).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(4);
    expect(Object.keys(instanceStates)).toEqual([idA, idB]);
    expect(await submit("A")).not.toBe(idA);
    expect(install).toHaveBeenCalledTimes(3);
  });
}
