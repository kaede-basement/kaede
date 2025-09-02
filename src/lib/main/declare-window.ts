import { ApplicationNamespace } from "@/constants/application.ts";

export function declareWindow() {
  window[ApplicationNamespace] = {
    "constants": {},
    "variables": {},
    "hooks"    : {
      "getConfigFile": {
        "before": async () => {},
      },
      "getDefaultConfig": {
        "before": async () => {},
      },
    },
  };
}