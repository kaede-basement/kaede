import { mockIPC } from "@tauri-apps/api/mocks";
import * as dialog from "@tauri-apps/plugin-dialog";
import { expect, spyOn, test } from "bun:test";
import { computed, shallowRef, type VNodeChild } from "vue";

import { mockSaveAccounts } from "@/__mocks__/save-accounts.ts";
import {
  AuthOneTimeFetchContextKey, AuthStatesContextKey, TranslationsContextKey,
} from "@/constants/application.ts";
import English from "@/constants/english.json";
import { C } from "@/extendable/component-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Configs from "@/lib/configs";
import { accountStoreError } from "@/lib/configs/scopes/account-store.ts";
import Launcher from "@/lib/launcher";
import Watchers from "@/lib/watchers";
import { declareInstanceStates, instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

test("startup account errors identify preserved storage in Profile and Launch", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {} } as InstanceStateType;
  const wrapper = C.PageWrapper;
  const context = GlobalInternals.instanceContext;

  await using cleanup = new AsyncDisposableStack;
  cleanup.defer(async () => {
    C.PageWrapper = wrapper;
    GlobalInternals.instanceContext = context;
    await Configs.getAccounts({ "parsedFile": { "status": "loaded", "data": [] } });
  });
  const webgl = Object.getOwnPropertyDescriptor(globalThis, "WebGL2RenderingContext");

  Object.defineProperty(globalThis, "WebGL2RenderingContext", {
    "configurable": true, "value": {},
  });
  cleanup.defer(() => {
    if (webgl) Object.defineProperty(globalThis, "WebGL2RenderingContext", webgl);
    else Reflect.deleteProperty(globalThis, "WebGL2RenderingContext");
  });
  C.PageWrapper = (_, { slots }): VNodeChild => slots.default?.();
  using watch = spyOn(Watchers, "watchProcesses").mockResolvedValue(() => {});
  mockIPC(() => []);
  using notify = spyOn(dialog, "message").mockResolvedValue("Ok");
  using provider = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, []);
  });
  using profile = await mountComponent("profile/Profile", {}, app => {
    app.provide(AuthStatesContextKey, shallowRef([]));
    app.provide(TranslationsContextKey, computed(() => English));
  });
  for (const parsedFile of [
    { "status": "unreadable" } as const,
    { "status": "corrupt", "raw": "{", "error": "invalid JSON" } as const,
  ]) {
    expect(await Configs.getAccounts({ parsedFile })).toEqual([]);
    await GlobalInternals.instanceContext!.launchInstance("game");
    expect(profile.root.querySelector("[role=alert]")?.textContent)
      .toContain("original file was preserved");
    expect(profile.root.querySelector("#__profile-page__accounts-empty")).toBeNull();
    expect(notify.mock.calls[notify.mock.calls.length - 1][0])
      .toContain("original file was preserved");
  }
  expect(watch).toHaveBeenCalledTimes(1);
  expect(provider.root.textContent).toBe("");
});

test("a fresh Microsoft account launches read-only from a damaged store", async () => {
  declareInstanceStates();
  instanceStates.game = { "patchVersions": {} } as InstanceStateType;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = "header." + btoa(JSON.stringify({ exp })) + ".signature";
  const valid = {
    "profile": { "name": "player", "uuid": "u", "type": "msa" },
    "msa"    : { token, "refreshToken": "refresh" },
    "skin"   : { "variant": "classic", "id": "", "data": "", "url": "" },
  } as const;
  const context = GlobalInternals.instanceContext;
  const originalError = accountStoreError.value;

  using cleanup = new DisposableStack;
  cleanup.defer(() => {
    GlobalInternals.instanceContext = context;
    accountStoreError.value = originalError;
  });
  mockIPC(() => []);
  using save = mockSaveAccounts();
  const accounts = await Configs.getAccounts({
    "parsedFile": { "status": "loaded", "data": [valid, null] },
  });

  expect(accounts).toEqual([valid]);
  expect(accountStoreError.value).toBe(true);
  using handle = spyOn(Launcher, "handleLaunch").mockResolvedValue({
    "success": false, "process": undefined, "reason": "cancelled",
  });
  using provider = await mountComponent("general/misc/ContextProviders", {}, app => {
    app.provide(AuthOneTimeFetchContextKey, accounts);
  });
  await GlobalInternals.instanceContext!.launchInstance("game");
  expect(handle.mock.calls[0]?.[0].userPreferences.account?.token).toBe(token);
  expect(save).not.toHaveBeenCalled();
  expect(accountStoreError.value).toBe(true);
  expect(provider.root.textContent).toBe("");
});
