import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, mock, spyOn, test } from "bun:test";
import { shallowRef } from "vue";

import { mockSaveAccounts } from "@/__mocks__/save-accounts.ts";
import { ActionKeys, AuthOneTimeFetchContextKey } from "@/constants/application.ts";
import { ActionRegistry } from "@/extendable/action-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Auth from "@/lib/auth";
import * as refresh from "@/lib/auth/scopes/ensure-fresh-account.ts";
import * as store from "@/lib/configs/scopes/account-store.ts";
import { declareActionRegistry } from "@/lib/globals/declare-action-registry.ts";
import Launcher from "@/lib/launcher";
import Watchers from "@/lib/watchers";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

const original: AccountType = {
  "profile": { "uuid": "id", "name": "player", "type": "msa" },
  "msa"    : { "token": "original", "refreshToken": "original" },
  "skin"   : { "variant": "classic", "id": "", "data": "", "url": "" },
};
const winner = { ...original, "msa": { "token": "winning", "refreshToken": "winning" } };
const stale = { ...original, "msa": { "token": "stale", "refreshToken": "stale" } };

test("Profile refresh respects the record at commit and reports a removed UUID", async () => {
  declareActionRegistry();
  const accounts = shallowRef([original]);
  const handlers = { "pending": mock(), "reset": mock(), "success": mock(), "error": mock() };

  using fresh = spyOn(Auth, "ensureFreshAccount")
    .mockResolvedValue({ "account": stale, "status": "refreshed" });
  using read = spyOn(store, "readAccountText").mockResolvedValueOnce(JSON.stringify([winner]))
    .mockResolvedValueOnce("[]");
  using save = mockSaveAccounts();
  const run = (): Promise<unknown> => ActionRegistry.execute(ActionKeys.AccountsRefresh, {
    "account": original, accounts, handlers,
  });

  await run();
  expect(accounts.value).toEqual([winner]);
  expect(handlers.success).toHaveBeenCalledTimes(1);
  await run();
  expect(accounts.value).toEqual([]);
  expect(handlers.success).toHaveBeenCalledTimes(1);
  expect(handlers.error.mock.calls[0][0]).toContain("account was removed");
  expect(save).not.toHaveBeenCalled();
  expect(fresh).toHaveBeenCalledTimes(2);
  expect(read).toHaveBeenCalledTimes(2);
});

test("launch distinguishes removal from decline and uses the winning token", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {} } as InstanceStateType;
  const context = GlobalInternals.instanceContext;

  using cleanup = new DisposableStack;
  cleanup.defer(() => GlobalInternals.instanceContext = context);
  mockIPC(() => []);
  using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
  const profiles = [original];

  using view = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, profiles);
  });
  using fresh = spyOn(refresh, "ensureFreshAccount")
    .mockResolvedValueOnce({ "account": stale, "status": "refreshed" })
    .mockResolvedValueOnce({ "account": original, "status": "failed" })
    .mockResolvedValueOnce({ "account": stale, "status": "refreshed" });
  using read = spyOn(store, "readAccountText").mockResolvedValueOnce("[]")
    .mockResolvedValueOnce(JSON.stringify([winner]));
  using confirm = spyOn(dialog, "confirm").mockResolvedValue(false);
  using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
  using save = mockSaveAccounts();
  using handle = spyOn(Launcher, "handleLaunch").mockResolvedValue({
    "success": false, "process": undefined, "reason": "cancelled",
  });
  const launch = GlobalInternals.instanceContext!.launchInstance;

  await launch("game");
  expect(notify.mock.calls[0][0]).toContain("Select or add an account");
  await launch("game");
  expect(handle).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalledTimes(1);
  await launch("game");
  expect(handle.mock.calls[0][0].userPreferences.account?.token).toBe(winner.msa.token);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  expect(read).toHaveBeenCalledTimes(2);
  expect(fresh).toHaveBeenCalledTimes(3);
  expect(watch).toHaveBeenCalledTimes(1);
  expect(view.root.textContent).toBe("");
});

test("launch takes credentials from the live record after a delayed Java probe", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {} } as InstanceStateType;
  const context = GlobalInternals.instanceContext;
  const major = GlobalInternals.javaMajor;

  using cleanup = new DisposableStack;
  cleanup.defer(() => {
    GlobalInternals.instanceContext = context;
    GlobalInternals.javaMajor = major;
  });
  GlobalInternals.javaMajor = undefined;
  mockIPC(() => []);
  using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
  const profiles = [original];

  using view = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, profiles);
  });
  const java = Promise.withResolvers<number>();

  using probe = spyOn(Launcher, "fetchJavaMajor").mockReturnValue(java.promise);
  using fresh = spyOn(refresh, "ensureFreshAccount")
    .mockResolvedValue({ "account": original, "status": "fresh" });
  using handle = spyOn(Launcher, "handleLaunch").mockResolvedValue({
    "success": false, "process": undefined, "reason": "cancelled",
  });
  const pending = GlobalInternals.instanceContext!.launchInstance("game");

  await Bun.sleep(0);
  expect(fresh).toHaveBeenCalledTimes(1);
  profiles.splice(0, 1, winner);
  java.resolve(17);
  await pending;
  expect(handle.mock.calls[0][0].userPreferences.account?.token).toBe(winner.msa.token);
  expect(probe).toHaveBeenCalledTimes(1);
  expect(watch).toHaveBeenCalledTimes(1);
  expect(view.root.textContent).toBe("");
});
