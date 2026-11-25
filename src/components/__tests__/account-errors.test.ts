import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as core from "@tauri-apps/api/core";
import * as dialog from "@tauri-apps/plugin-dialog";
import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";
import { computed, nextTick, shallowRef } from "vue";

import { mockSaveAccounts } from "@/__mocks__/save-accounts.ts";
import {
  ActionKeys, AuthStatesContextKey, TranslationsContextKey,
} from "@/constants/application.ts";
import English from "@/constants/english.json";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import Auth from "@/lib/auth";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import * as store from "@/lib/configs/scopes/account-store.ts";
import { declareActionRegistry } from "@/lib/globals/declare-action-registry.ts";
import Hashing from "@/lib/hashing";
import type { AccountType } from "@/types/configs/account.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

const account: AccountType = {
  "profile": { "uuid": "one", "name": "first", "type": "offline" },
  "msa"    : null, "skin"   : { "id": "", "data": "", "url": "", "variant": "classic" },
};

test("all account mutations preserve corrupt disk bytes and both loaded profiles", async () => {
  declareActionRegistry();
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaede-accounts-"));

  await using cleanup = new AsyncDisposableStack;
  cleanup.defer(() => rm(directory, { "recursive": true }));
  const filename = path.join(directory, "accounts.json");
  const file = Bun.file(filename);
  const initial = [account, { ...account, "profile": { ...account.profile, "uuid": "two" } }];

  await Bun.write(file, JSON.stringify(initial));
  const accounts = shallowRef(await Configs.getAccounts({
    "parsedFile": { "status": "loaded", "data": await file.json() },
  }));

  using read = spyOn(store, "readAccountText")
    .mockImplementation(async () => readFileSync(filename, "utf8"));
  using write = mockSaveAccounts().mockImplementation(async ({ contents, createNew }) => {
    await writeFile(filename, contents, { "flag": createNew ? "wx" : "w" });
  });
  using confirm = spyOn(dialog, "confirm").mockResolvedValue(true);
  using fresh = spyOn(Auth, "ensureFreshAccount")
    .mockResolvedValue({ account, "status": "refreshed" });
  using hash = spyOn(Hashing, "hashOfflineNickname").mockResolvedValue("new-id");
  const invalid = "{\"unfinished\":";

  await Bun.write(file, invalid);
  const handlers = { "error": mock(), "success": mock(), "pending": mock(), "reset": mock() };

  for (const key of [ActionKeys.AccountsRefresh, ActionKeys.AccountsRemove]) {
    await ActionRegistry.execute(key, { accounts, account, handlers });
  }
  expect(handlers.error).toHaveBeenCalledTimes(2);
  expect(handlers.success).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalled();
  expect(fresh).toHaveBeenCalled();
  using view = await mountComponent("profile/Logins/Offline", {}, app => {
    app.provide(AuthStatesContextKey, accounts);
    app.provide(TranslationsContextKey, computed(() => English));
  });
  Reflect.get(view.root.querySelector("test-child")!, "on-click")();
  await nextTick();
  Reflect.get(view.root.querySelector("test-child")!, "on-input")("nickname");
  await nextTick();
  view.root.querySelector<HTMLButtonElement>("[id$=offline-confirm]")!.click();
  await Bun.sleep(0);
  expect(view.root.querySelector("[role=alert]")?.textContent).toContain("Could not save");
  expect(hash).toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(3);
  expect(write).not.toHaveBeenCalled();
  expect(accounts.value).toEqual(initial);
  expect(await file.text()).toBe(invalid);

  for (const bytes of ["{}", JSON.stringify([account, null])]) {
    await Bun.write(file, bytes);
    await expect(Configs.updateAccounts(() => [])).rejects.toThrow();
    expect(await file.text()).toBe(bytes);
  }
  read.mockRejectedValue(new Error("Denied"));
  await expect(Configs.updateAccounts(() => [])).rejects.toThrow("Denied");
  expect(write).not.toHaveBeenCalled();
  read.mockImplementation(async (): Promise<undefined> => {});
  await expect(Configs.updateAccounts(() => [account])).rejects.toThrow("Failed to save");
  expect(await file.text()).toBe(JSON.stringify([account, null]));
  await rm(filename);
  await expect(Configs.updateAccounts(stored => [...stored, account])).resolves.toEqual([account]);
  expect(write).toHaveBeenCalledTimes(2);
});

test("account row enables retry after failed refresh or rejected confirmation", async () => {
  declareActionRegistry();
  const online = { ...account, "msa": { "token": "old", "refreshToken": "old" } };
  const accounts = shallowRef([online]);

  using fresh = spyOn(Auth, "ensureFreshAccount")
    .mockResolvedValue({ account, "status": "failed" });
  using stored = spyOn(store, "readAccountText").mockResolvedValue(JSON.stringify([online]));
  using confirm = spyOn(dialog, "confirm").mockRejectedValueOnce(new Error("dialog unavailable"))
    .mockResolvedValue(false);
  using notify = spyOn(dialog, "message").mockRejectedValueOnce(new Error("dialog unavailable"))
    .mockResolvedValue("Ok");
  using cleanup = new DisposableStack;
  if (!("WebGL2RenderingContext" in globalThis)) {
    Object.defineProperty(globalThis, "WebGL2RenderingContext", {
      "configurable": true, "value": {},
    });
    cleanup.defer(() => Reflect.deleteProperty(globalThis, "WebGL2RenderingContext"));
  }
  using view = await mountComponent("profile/AccountRow", {
    "idRoot": "profile", "index": 0, "account": online,
  }, app => {
    app.provide(AuthStatesContextKey, accounts);
    app.provide(TranslationsContextKey, computed(() => English));
  });
  const retry = async (index: number): Promise<void> => {
    const button = view.root.querySelector<HTMLButtonElement>(`#profile-action-${index}`)!;

    for (let click = 0; click < 2; click++) {
      expect(button.disabled).toBe(false);
      button.click();
      await Bun.sleep(0);
      if (index === 0 && click === 0) {
        expect(view.root.querySelector("[role=alert]")?.textContent).toContain("Failed to refresh");
      }
    }
  };

  await retry(0);
  expect(view.root.querySelector("[role=alert]")).toBeNull();
  expect(stored).toHaveBeenCalledTimes(2);
  await retry(2);
  expect(fresh).toHaveBeenCalledTimes(2);
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenCalledTimes(3);
});

test("startup preserves corrupt accounts and reads a concurrently initialized file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kaede-startup-"));

  await using cleanup = new AsyncDisposableStack;
  cleanup.defer(() => rm(directory, { "recursive": true }));
  const file = path.join(directory, "accounts.json");
  const raw = "{malformed";

  await Bun.write(file, raw);
  using write = mockSaveAccounts().mockImplementation(async ({ contents, createNew }) => {
    await writeFile(file, contents, { "flag": createNew ? "wx" : "w" });
  });
  using read = spyOn(store, "readAccountText")
    .mockImplementation(async () => readFileSync(file, "utf8"));
  const parsedFile = { "status": "corrupt" as const, raw, "error": "invalid" };

  expect(await Configs.getAccounts({ parsedFile })).toEqual([]);
  expect(readFileSync(file, "utf8")).toBe(raw);
  expect(await Configs.getAccounts()).toEqual([]);
  expect(readFileSync(file, "utf8")).toBe(raw);
  await Bun.write(file, "{}");
  expect(await Configs.getAccounts()).toEqual([]);
  expect(write).not.toHaveBeenCalled();
  for (const empty of ["", " \n\t "]) {
    await Bun.write(file, empty);
    expect(await Configs.getAccounts({ "parsedFile": { "status": "missing" } })).toEqual([]);
    expect(await Configs.updateAccounts(current => [...current, account])).toEqual([account]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([account]);
  }
  const concurrent = JSON.stringify([account]);

  await Bun.write(file, concurrent);
  expect(await Configs.getAccounts({ "parsedFile": { "status": "missing" } })).toEqual([account]);
  expect(readFileSync(file, "utf8")).toBe(concurrent);
  expect(write).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(7);
});

test("native storage needs acknowledgment and browser writes bypass the command", async () => {
  using invoke = spyOn(core, "invoke").mockImplementation(async cmd => (
    cmd === "read_accounts_file" ? { "status": "missing" } : undefined
  ) as never);
  expect(await Configs.writeAccounts({ "accounts": [account] })).toBe(false);
  using browser = spyOn(Browser, "detectIsBrowser").mockReturnValue(true);
  using exists = spyOn(fs, "exists").mockResolvedValue(false);
  using write = spyOn(fs, "writeTextFile").mockResolvedValue();
  expect(await Configs.writeAccounts({ "accounts": [account] })).toBe(true);
  expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual(["read_accounts_file", "save_accounts"]);
  expect(exists).toHaveBeenCalled();
  expect(browser).toHaveBeenCalled();
  expect(JSON.parse(write.mock.calls[0][1])).toEqual([account]);
});

test("invalid UTF-8 never reaches an account write", async () => {
  using invoke = spyOn(core, "invoke").mockResolvedValue({ "status": "invalidUtf8" });
  await expect(Configs.updateAccounts(() => [account]))
    .rejects.toThrow("Cannot decode accounts.json");
  expect(invoke.mock.calls.map(([command]) => command)).toEqual(["read_accounts_file"]);
  expect(store.accountStoreError.value).toBe(true);
  await Configs.getAccounts({ "parsedFile": { "status": "loaded", "data": [] } });
});

test("whitespace recovery replays a conflicting mutation against committed accounts", async () => {
  const pending = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const second = { ...account, "profile": { ...account.profile, "uuid": "other" } };
  let raw = " \n";

  using read = spyOn(store, "readAccountText").mockImplementation(async () => raw);
  using write = mockSaveAccounts().mockImplementation(async ({ contents, expectedPrevious }) => {
    pending.resolve();
    await resume.promise;
    if (raw !== expectedPrevious) throw store.AccountConflict;
    raw = contents;
  });
  const update = Configs.updateAccounts(current => [...current, account]);

  await pending.promise;
  raw = JSON.stringify([second]);
  resume.resolve();
  expect(await update).toEqual([second, account]);
  expect(JSON.parse(raw)).toEqual([second, account]);
  expect(read).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenCalledTimes(2);
});
