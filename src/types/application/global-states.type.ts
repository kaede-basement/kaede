import type { RouteType } from "@/types/application/route.type.ts";
import type { ShallowReactive } from "vue";

export type GlobalStatesType = {
  "customLayout": boolean;
  "page"        : RouteType;
  "pageStates"  : Record<RouteType, object>;
  "showLogs"    : boolean;
  "sidebarItems": Array<{
    "path"  : RouteType;
    "icon"  : string;
    "name"  : string;
    "action": () => void;
  }>;
  "contextMenuItems": Array<{
    "icon"  : string;
    "name"  : string;
    "action": () => void;
  }>;
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;