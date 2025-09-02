import type { ConfigType } from "@/types/config/config.schema.ts";
import type { log } from "@/lib/handlers/log.ts";
import type { extractError } from "@/lib/helpers/extract-error.ts";
import type { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import type { getConfigFile } from "@/lib/main/get-config-file.ts";
import type { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import type { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";

declare global {
  interface Window {
    "__KAEDE__": {
      "constants": object; // TODO
      "variables": object; // TODO
      "functions": {
        "log"                 : typeof log;
        "extractError"        : typeof extractError;
        "getRelativeDate"     : typeof getRelativeDate;
        "getConfigFile"       : typeof getConfigFile;
        "getDefaultConfig"    : typeof getDefaultConfig;
        "initializeConfigFile": typeof initializeConfigFile;
      };
      "hooks": {
        "getConfigFile": {
          "before": () => Promise<"stop" | void>;
        };
        "getDefaultConfig": {
          "before" : () => Promise<"stop" | void>;
          "onAbort": () => Promise<ConfigType>;
        };
      };
    };
  }
}