import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";
import { computed, nextTick, shallowRef } from "vue";

import { mockSaveAccounts } from "@/__mocks__/save-accounts.ts";
import {
  ActionKeys, AuthStatesContextKey, TranslationsContextKey,
} from "@/constants/application.ts";
import English from "@/constants/english.json";
import { DefaultInstanceIcon, DefaultInstanceSettings } from "@/constants/launcher.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Auth from "@/lib/auth";
import { declareActionRegistry } from "@/lib/globals/declare-action-registry.ts";
import Hashing from "@/lib/hashing";
import { detectJavaInstallations } from "@/lib/launcher/fetching/detect-java-installations.ts";
import { globalStates } from "@/states/global.ts";
import { javaStates } from "@/states/java.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

const account: AccountType = {
  "profile": { "uuid": "id", "name": "original", "type": "offline" },
  "msa"    : null, "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
};

test("account actions report write failure and keep committed accounts", async () => {
  declareActionRegistry();
  const accounts = shallowRef([account]);
  const handlers = { "error": mock(), "success": mock(), "pending": mock(), "reset": mock() };

  using refresh = spyOn(Auth, "ensureFreshAccount").mockResolvedValue({
    "status" : "refreshed",
    "account": { ...account, "profile": { ...account.profile, "name": "updated" } },
  });
  using read = spyOn(fs, "readTextFile").mockResolvedValue(JSON.stringify([account]));
  using write = mockSaveAccounts().mockRejectedValue(new Error("Disk full"));
  using confirm = spyOn(dialog, "confirm").mockResolvedValue(true);

  for (const key of [ActionKeys.AccountsRefresh, ActionKeys.AccountsRemove]) {
    await ActionRegistry.execute(key, { accounts, account, handlers });
    expect(accounts.value).toEqual([account]);
    expect(handlers.success).not.toHaveBeenCalled();
  }
  expect(handlers.error).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(1);
});

test("failed offline account write keeps nickname and retries in place", async () => {
  const accounts = shallowRef([account]);

  using read = spyOn(fs, "readTextFile").mockResolvedValue(JSON.stringify([account]));
  using hash = spyOn(Hashing, "hashOfflineNickname").mockResolvedValue("new-id");
  using write = mockSaveAccounts().mockRejectedValueOnce(new Error("Disk full"))
    .mockResolvedValue();
  using view = await mountComponent("profile/Logins/Offline", {}, app => {
    app.provide(AuthStatesContextKey, accounts);
    app.provide(TranslationsContextKey, computed(() => English));
  });
  Reflect.get(view.root.querySelector("test-child")!, "on-click")();
  await nextTick();
  const input = view.root.querySelector("test-child")!;

  Reflect.get(input, "on-input")("nickname");
  await nextTick();
  const save = view.root.querySelector<HTMLButtonElement>("[id$=offline-confirm]")!;

  save.click();
  await Bun.sleep(0);
  expect(view.root.querySelector("[role=\"alert\"]")?.textContent).toContain("Could not save");
  expect(Reflect.get(input, "default-value")).toBe("nickname");
  expect(accounts.value).toEqual([account]);
  save.click();
  await Bun.sleep(0);
  expect(accounts.value[0].profile.name).toBe("nickname");
  expect(read).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(2);
  expect(hash).toHaveBeenCalledWith("nickname");
});

const manifest = {
  "name"        : "Fabric pack", "versionId"   : "v1", "files"       : [],
  "dependencies": { "minecraft": "1.20", "fabric-loader": "0.16" },
};

test("plain zip clears the previous pack draft and keeps its warning on Import", async () => {
  const page = globalStates.pages["add-instance"];
  const select = mock();

  page.select = select;
  using open = spyOn(dialog, "open").mockResolvedValueOnce("old.mrpack")
    .mockResolvedValueOnce("packs/plain.zip")
    .mockRejectedValueOnce(new Error("Unavailable"));
  const peek = mock().mockReturnValueOnce(manifest)
    .mockReturnValueOnce(null);

  mockIPC(peek);
  using view = await mountComponent("add-instance/sections/ImportModpack");
  const pick = Reflect.get(view.root.querySelector("test-child")!, "on-click");

  await pick();
  expect(page.instance?.name).toBe(manifest.name);
  expect(page.instance?.patchVersions["net.fabricmc.fabric-loader"]).toBe("0.16");
  page.instance!.icon = "old-icon.png";
  page.instanceVersionSearch!.input = "old search";
  await pick();
  expect(page.importedModpack).toBeUndefined();
  expect(page.instance?.name).toBe(DefaultInstanceSettings.name);
  expect(page.instance?.icon).toBe(DefaultInstanceIcon);
  expect(page.instance?.patchVersions).toEqual({ "net.minecraft": "1.16.5" });
  expect(page.instanceVersionSearch).toEqual({ "patch": "net.minecraft", "input": "" });
  expect(select).toHaveBeenCalledTimes(1);
  expect(view.root.textContent).toContain("plain.zip");
  expect(view.root.textContent).toContain("No Modrinth manifest inside");
  await pick();
  expect(view.root.textContent).toContain("Unavailable");
  expect(open).toHaveBeenCalledTimes(3);
  expect(peek).toHaveBeenCalledTimes(2);
});

test("a stale import resolving after remount cannot clear the newer pack", async () => {
  const page = globalStates.pages["add-instance"];
  const select = mock();

  page.select = select;
  using open = spyOn(dialog, "open").mockResolvedValueOnce("older.zip")
    .mockResolvedValueOnce("newer.mrpack");
  const started = Promise.withResolvers<void>();
  const older = Promise.withResolvers<null>();

  mockIPC((_, arguments_) => {
    if ((arguments_ as { "archivePath": string }).archivePath === "older.zip") {
      started.resolve();

      return older.promise;
    }

    return manifest;
  });
  let first: Promise<void>;

  {
    using view = await mountComponent("add-instance/sections/ImportModpack");

    first = Reflect.get(view.root.querySelector("test-child")!, "on-click")();
    await started.promise;
  }
  using view = await mountComponent("add-instance/sections/ImportModpack");
  await Reflect.get(view.root.querySelector("test-child")!, "on-click")();
  older.resolve(null);
  await first;
  expect(page.importedModpack?.path).toBe("newer.mrpack");
  expect(page.instance?.name).toBe(manifest.name);
  expect(select).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(2);
});

test("Java scan retries, shares pending work and retains empty success", async () => {
  const previous = { ...javaStates };

  using cleanup = new DisposableStack;
  cleanup.defer(() => Object.assign(javaStates, previous));
  javaStates.status = "idle";
  const scan = Promise.withResolvers<never[]>();
  const invoke = mock().mockRejectedValueOnce(new Error("Unavailable"))
    .mockReturnValue(scan.promise);

  mockIPC(invoke);
  using view = await mountComponent("add-instance/sections/ChangeJavaBinary");
  await Bun.sleep(0);
  expect(view.root.textContent).toContain("Could not detect Java");
  view.root.querySelector<HTMLButtonElement>("#__instance-java-retry")!.click();
  const second = detectJavaInstallations();

  expect<string>(javaStates.status).toBe("scanning");
  scan.resolve([]);
  await second;
  await detectJavaInstallations();
  expect(view.root.textContent).toContain("No Java runtimes found");
  expect(invoke).toHaveBeenCalledTimes(2);
});

for (const present of [true, false]) {
  const scenario = present ? "unreadable siblings" : "a missing directory";

  test("CSS loader handles " + scenario, async () => {
    using exists = spyOn(fs, "exists").mockResolvedValue(present);
    using read = spyOn(fs, "readDir").mockResolvedValue(["a.css", "b.css", "c.css"].map(name => ({
      name, "isDirectory": false, "isFile": true, "isSymlink": false,
    })));
    using contents = spyOn(fs, "readTextFile").mockResolvedValueOnce("first{}")
      .mockRejectedValueOnce(new Error("Denied"))
      .mockResolvedValueOnce("last{}");
    const { log } = await import("@/lib/logging/log.ts");

    using error = spyOn(log, "error");
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");

    using cleanup = new DisposableStack;
    cleanup.defer(() => {
      if (original) {
        Object.defineProperty(globalThis, "document", original);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
    });
    using view = await mountComponent("general/extensions/CssThemeLoader", {}, (_, document) => {
      Object.defineProperty(globalThis, "document", { "configurable": true, "value": document });
    });
    await Bun.sleep(0);
    expect([...document.head.querySelectorAll("style")].map(sheet => sheet.textContent))
      .toEqual(present ? ["first{}", "last{}"] : []);
    expect(exists).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(present ? 1 : 0);
    expect(contents).toHaveBeenCalledTimes(present ? 3 : 0);
    expect(error).toHaveBeenCalledTimes(present ? 1 : 0);
    if (present) {
      expect(error.mock.calls[0]).toContain("b.css");
    }
    expect(view.root.childElementCount).toBe(1);
  });
}
