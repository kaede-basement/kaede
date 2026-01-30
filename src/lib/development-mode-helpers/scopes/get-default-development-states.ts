import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getDefaultDevelopmentStates(): GlobalStatesType["development"] {
  return {
    "showFPS"                   : false,
    "enableDebugMode"           : false,
    "enableNativeContextMenu"   : false,
    "enableNativeReloadKeyBinds": false,
  };
}
