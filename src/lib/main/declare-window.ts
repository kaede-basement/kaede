import { ApplicationNamespace } from "@/constants/application.ts";

export function declareWindow() {
  window[ApplicationNamespace] = {
    "getConfigFile": {
      "before": async () => {},
    },
    "getDefaultConfig": {
      "before": async () => {},
    },
  };
}