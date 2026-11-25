import { expect, mock, test } from "bun:test";
import { nextTick } from "vue";

import { asyncNoop, internals, invoke, mount, noop, state } from "./idle-ui-harness.ts";

test("shell and extension mounts share a deferred, retryable executable digest", async () => {
  const digest = Promise.withResolvers<string>();
  const hash = "ab".repeat(32);

  mock.module("@/constants/ascii-art.ts", () => ({
    "default": { "getASCIIArt": (): string => "" },
  }));
  const { ensureExecutableHash } = await import("@/lib/initialization/start.ts");

  invoke.mockImplementationOnce(async () => {
    throw new Error("read failed");
  });
  await expect(ensureExecutableHash()).rejects.toThrow("read failed");
  invoke.mockClear();
  invoke.mockImplementation(async command => {
    if (command === "get_initial_shell_state") {
      return { "basic": {}, "parsed": {} };
    }
    expect(command).toBe("get_executable_hash");

    return digest.promise;
  });

  const globalObject = { "internals": internals, "libs": {} };

  Object.assign(globalThis, { "window": { "__KAEDE__": globalObject } });
  mock.module("@/extendable/global-object.ts", () => ({ "GlobalObject": globalObject }));
  for (const path of [
    "@/components/general/extensions/PermissionsHandler.vue",
    "@/components/general/layout/PageTeleports.vue",
    "@/lib/extension-api",
    "@/lib/permissions",
    "@/lib/txiki",
  ]) {
    mock.module(path, () => ({ "default": {} }));
  }
  const activate = mock(() => {
    expect(window.__KAEDE__.internals.executableHash).toBe(hash);

    return { "disable": noop };
  });

  mock.module("@/lib/extensions", () => ({
    "default": {
      "readExtensions": async (): Promise<object> => ({
        "valid": [{ "sha256": "enabled", "metadata": { "type": "sandbox" } }], "invalid": [],
      }),
      "dirtyLifecycle"     : async (): Promise<boolean> => true, "runInSandbox"       : activate,
      "showWebviewWindow"  : asyncNoop, "updateTrustedHashes": asyncNoop,
    },
  }));
  const { "default": loader } = await import("@/components/general/extensions/ExtensionLoader.vue");

  const show = mock(asyncNoop);
  const mounted = mock(noop);
  const vue = await import("vue");
  const app = { "mount": mounted, "provide": noop, "use": noop };

  mock.module("vue", () => ({ ...vue, "createApp": (): typeof app => app }));
  mock.module("@tauri-apps/api/webviewWindow", () => ({
    "getCurrentWebviewWindow": (): { "show": typeof show } => ({ show }),
  }));
  mock.module("@/lib/configs", () => ({ "default": {
    "getSafe": (): typeof state => state, "getAccounts": noop, "getTranslations": noop,
  } }));
  mock.module("@/lib/watchers", () => ({ "default": {
    "watchConfigSync"       : noop, "watchInstancesSync"    : noop, "watchDevelopmentStates": noop,
    "watchLocaleStates"     : noop, "watchCustomFont"       : noop,
    "watchProcesses"        : asyncNoop,
  } }));
  mock.module("@/states/servers.ts", () => ({ "declareServerProcesses": noop }));
  mock.module("@/lib/initialization", () => ({ "default": { "finish": asyncNoop } }));
  mock.module("@/lib/globals", () => ({ "default": {
    "declareGlobals": noop, "declareActionRegistry": noop,
  } }));
  mock.module("@/lib/logging/log.ts", () => ({
    "log": { "info"     : noop, "error"    : noop, "debug"    : noop,
      "templates": { "json": { "contents": noop } } },
  }));
  for (const path of ["virtual:uno.css", "@/App.vue", "@tanstack/vue-query"]) {
    mock.module(path, () => ({ "default": {}, "VueQueryPlugin": {} }));
  }
  await import("@/main.ts");
  await Bun.sleep(0);
  expect(show).toHaveBeenCalledTimes(1);
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(invoke.mock.calls.map(([command]) => command)).toEqual([
    "get_initial_shell_state", "get_executable_hash",
  ]);
  const view = mount(loader, "");

  await nextTick();
  expect(internals.executableHash).toBe("");
  expect(activate).not.toHaveBeenCalled();
  digest.resolve(hash);
  await Bun.sleep(0);
  expect(activate).toHaveBeenCalledTimes(1);
  view.unmount();
  const later = mount(loader, "");

  await Bun.sleep(0);
  expect(activate).toHaveBeenCalledTimes(2);
  expect(invoke.mock.calls.map(([command]) => command)).toEqual([
    "get_initial_shell_state", "get_executable_hash",
  ]);
  later.unmount();
});
