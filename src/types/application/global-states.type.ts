import type { ShallowReactive } from "vue";

import type { RouteType } from "@/types/application/route.type.ts";

export type GlobalStatesType = {
  "customLayout": boolean;
  "page"        : RouteType;
  "pageStates"  : Record<RouteType, object>;
  "showLogs"    : boolean;
  "sidebarItems": Array<"divider" | {
    "path"  : RouteType;
    "name"  : string;
    "action": () => void;
    "icon" ?: string;
    "image"?: string;
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