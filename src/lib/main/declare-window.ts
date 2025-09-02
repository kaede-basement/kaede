import { ApplicationNamespace } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";

export function declareWindow() {
  window[ApplicationNamespace] = {
    "constants": {},
    "variables": {},
    "hooks"    : {
      "getConfigFile": {
        "before": async () => {},
      },
      "getDefaultConfig": {
        "before" : async () => {},
        "onAbort": async () => getDefaultConfig(),
      },
    },
  };
}