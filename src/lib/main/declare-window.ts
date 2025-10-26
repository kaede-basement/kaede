import { ApplicationNamespace } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";
import { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function declareWindow() {
  window[ApplicationNamespace] = {
    "variables": {
      "rippleColor": "#ffffff15",
    },
    "functions": {
      "getGlobalStates"   : () => ({} as GlobalStatesType), // will be overwritten
      "changeGlobalStates": () => {}, // will be overwritten
      log,
      extractError,
      getRelativeDate,
      getConfigFile,
      getDefaultConfig,
      initializeConfigFile,
    },
    "hooks": {
      "getConfigFile": {
        "before": [],
      },
      "getDefaultConfig": {
        "before": [],
      },
      "onRouteChange": {
        "before": [],
        "after" : [],
      },
      "onCustomLayoutToggle": {
        "before": [],
        "after" : [],
      },
      "onPageStatesChange": {
        "before": [],
        "after" : [],
      },
      "onSidebarItemsChange": {
        "before": [],
        "after" : [],
      },
    },
  };
}