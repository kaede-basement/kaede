import { afterEach, beforeEach, spyOn } from "bun:test";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import Configs from "@/lib/configs";
import Router from "@/lib/router";
import { declareGlobalStates } from "@/states/global.ts";

export function useUiState(): void {
  let cleanup: DisposableStack;

  afterEach(() => cleanup.dispose());
  beforeEach(async () => {
    cleanup = new DisposableStack;
    const original = Object.getOwnPropertyDescriptor(globalThis, "window");

    Object.defineProperty(globalThis, "window", {
      "configurable": true, "value": { crypto, "__KAEDE__": { ...GlobalObject, "states": {} } },
    });
    cleanup.defer(() => {
      if (original) {
        Object.defineProperty(globalThis, "window", original);
      } else {
        Reflect.deleteProperty(globalThis, "window");
      }
    });
    const config = GlobalInternals.initialConfig;

    GlobalInternals.initialConfig = await Configs.getDefault();
    cleanup.use(spyOn(Router, "getInitialPage").mockReturnValue("home"));
    declareGlobalStates();
    GlobalInternals.initialConfig = config;
  });
}
