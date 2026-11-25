import { mockIPC } from "@tauri-apps/api/mocks";
import { createApp, defineComponent, isShallow } from "vue";

import { registerComponents } from "@/bootstrap/register-components.ts";
import { C } from "@/extendable/component-registry.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Globals from "@/lib/globals";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

mockIPC(() => {});
registerComponents();
Globals.declareGlobals();

async function checkExtensionAPI(): Promise<Record<string, unknown>> {
  const api = window.__KAEDE__;
  const { Launcher, "Globals": components } = api.libs;
  let detected = false;

  Object.assign(Launcher, {
    "detectJavaInstallations": async (): Promise<void> => {
      detected = true;
    },
  });
  await api.constants.Application.SettingsSections.find(tab => tab.id === "java")!.await!();

  Object.assign(Launcher.Parsers, { "buildUrlFromBase": (): string => "patched" });
  const artifact = Launcher.Parsers.parseLibrary({
    "library"    : { "name": "group:artifact:1" },
    "necessaries": { "directories": { "libraries": "libs" } } as PreLaunchInformationType,
    "isMaven"    : false,
    "patchUid"   : "patch",
  });

  api.hooks = { ...api.hooks, "onPreLaunchInformation": { "before": [], "after": [] } };
  api.hooks.onPreLaunchInformation.before = [
    (): { "status": "stop"; "response": false } => ({ "status": "stop", "response": false }),
  ];
  const hookResult = api.libs.Hooks.catchSyncResponseHooks({
    "scope": "onPreLaunchInformation", "timing": "before", "toPass": {},
  });
  const builtin = C.Home;
  const replacement = defineComponent({});

  components.registerComponent("Home", replacement);
  const overridden = C.Home === replacement;
  const restored = components.restoreComponent("Home") && C.Home === builtin;

  api.internals.appInstance = createApp({});
  components.registerComponent("ExampleExtension", replacement);

  return {
    "global"    : api === GlobalObject,
    detected,
    "url"       : artifact && artifact.url,
    hookResult,
    "registry"  : components.Components === C && isShallow(C),
    "builtin"   : typeof builtin === "object" && "render" in builtin,
    overridden,
    restored,
    "registered": components.getComponent("ExampleExtension") === replacement,
  };
}

Object.assign(window, { checkExtensionAPI });
