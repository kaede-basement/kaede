import type { ConfigType } from "@/types/config/config.schema.ts";
import type { log } from "@/lib/handlers/log.ts";
import type { extractError } from "@/lib/helpers/extract-error.ts";
import type { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import type { getConfigFile } from "@/lib/main/get-config-file.ts";
import type { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import type { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import * as TauriApi from "@tauri-apps/api";
import * as TauriFs from "@tauri-apps/plugin-fs";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";

declare global {
  interface Window {
    "__TAURI__": {
      "api": typeof TauriApi;
      "fs" : typeof TauriFs;
    };
    "__KAEDE__": {
      "variables": {
        "rippleColor": string;
      };
      "functions": {
        "changeGlobalStates"  : GlobalStatesChangerType;
        "log"                 : typeof log;
        "extractError"        : typeof extractError;
        "getRelativeDate"     : typeof getRelativeDate;
        "getConfigFile"       : typeof getConfigFile;
        "getDefaultConfig"    : typeof getDefaultConfig;
        "initializeConfigFile": typeof initializeConfigFile;
      };
      "hooks": {
        "getConfigFile": {
          "before": HookReturnType<unknown, ConfigType>;
        };
        "getDefaultConfig": {
          "before": HookReturnType<unknown, ConfigType>;
        };
        "onRouteChange": {
          "before": HookReturnType<RouteType, RouteType, "non-promise">;
          "after" : HookReturnType<RouteType, "nothing">;
        };
        "onCustomLayoutToggle": {
          "before": HookReturnType<boolean, boolean, "non-promise">;
          "after" : HookReturnType<RouteType, "nothing">;
        };
        "onPageStatesChange": {
          "before": HookReturnType<unknown, unknown, "non-promise">;
          "after" : HookReturnType<RouteType, "nothing">;
        };
        "__PLACEHOLDER_DO_NOT_TOUCH": {
          "before": Array<unknown>;
          "after" : Array<unknown>;
        };
      };
    };
  }
}