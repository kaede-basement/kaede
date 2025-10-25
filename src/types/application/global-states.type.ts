import type { RouteType } from "@/types/application/route.type.ts";
import type { ShallowReactive } from "vue";

export type GlobalStatesType = {
  "customLayout": boolean;
  "page"        : RouteType;
  "pageStates"  : Record<RouteType, object>;
  "sidebarItems": Array<{}>;
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;