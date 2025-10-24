import { ApplicationNamespace } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";
import { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";

export function declareWindow() {
  window[ApplicationNamespace] = {
    "constants": {},
    "variables": {},
    "functions": {
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
    },
  };
}