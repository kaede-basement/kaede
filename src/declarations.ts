import type { ConfigType } from "@/types/config/config.schema.ts";

declare global {
  interface Window {
    "__KAEDE__": {
      "constants": object; // TODO
      "variables": object; // TODO
      "hooks": {
        "getConfigFile": {
          "before" : () => Promise<"stop" | void>;
        };
        "getDefaultConfig": {
          "before": () => Promise<"stop" | void>;
          "onAbort": () => Promise<ConfigType>;
        };
      };
    };
  }
}