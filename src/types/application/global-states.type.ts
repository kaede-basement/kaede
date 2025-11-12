import type { ShallowReactive } from "vue";

import type { LocaleType } from "@/types/application/locale.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";

export type GlobalStatesFileSystemType = {
  "portable": boolean;
  "base"    : string;
  "folders" : {
    "logs"     : string;
    "instances": string;
    "resources": string;
  };
  "files": {
    "config": string;
    "log"   : string;
  };
};
export type GlobalStatesLayoutType = {
  "custom"    : boolean;
  "background": Partial<{
    "url"  : string;
    "key"  : string | number;
    "blur" : number;
    "color": string;
  }>;
  "sidebar": Partial<{
    "blur"      : number;
    "color"     : string;
    "ripple"    : string;
    "sparkles"  : `${number} ${number} ${number}`;
    "background": string;
  }>;
};
export type GlobalStatesPagesType = {
  "current": RouteType;
  "states" : {
    "home": Partial<{
      // TODO: none / short / detailed
      "stats": unknown;
    }>;
    "library": Partial<{
      // TODO: instance list groups
      "group": unknown;
    }>;
    "settings": Partial<{
      // TODO: general / extensions / etc.
      "tab": unknown;
    }>;
    "add-instance": Partial<{
      // TODO: modrinth / curseforge / etc.
      "provider": unknown;
    }>;
    // Reserved for extensions' needs
    "none": Record<string, unknown>;
  };
};
export type GlobalStatesLogsType = {
  "show"       : boolean;
  "lineBreaks" : boolean;
  "virtualized": boolean;
  "dates"      : boolean;
  "filtering"  : string;
};
export type GlobalStatesSidebarItemsType = Array<"divider" | {
  "path"  : RouteType;
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
export type GlobalStatesContextMenuItems = Array<{
  "icon"  : string;
  "name"  : string;
  "action": () => void;
}>;

export type GlobalStatesType = {
  "locale"          : LocaleType;
  // Requires async access to Tauri API before initialization, so we also add undefined
  "fileSystem"      : GlobalStatesFileSystemType | undefined;
  "layout"          : GlobalStatesLayoutType;
  "pages"           : GlobalStatesPagesType;
  "logs"            : GlobalStatesLogsType;
  "sidebarItems"    : GlobalStatesSidebarItemsType;
  "contextMenuItems": GlobalStatesContextMenuItems;
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;
