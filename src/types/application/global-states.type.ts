import type { ShallowReactive } from "vue";

import type { RouteType } from "@/types/application/route.type.ts";
import type { LocaleType } from "@/types/translations/locale.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

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
    "sparkles"  : string;
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
export type GlobalStatesContextMenuItemsType = Array<{
  "icon"  : string;
  "name"  : string;
  "action": () => void;
}>;
export type GlobalStatesDevelopmentType = {
  "enabled"                   : boolean;
  "showFPS"                   : boolean;
  "enableDebugMode"           : boolean;
  "enableNativeReloadKeyBinds": boolean;
};
export type GlobalStatesMiscType = {
  "showBeforeInitialization": boolean;
  "enableDiscordRPC"        : boolean;
};
// Global minecraft settings
export type GlobalStatesMinecraftType = {
  "windowHeight": number;
  "windowWidth" : number;
  "jvmArgs"     : string;
};
// Per-instance minecraft settings
export type GlobalStatesMinecraftInstancesType = Record<string, GlobalStatesMinecraftType>;

export type GlobalStatesType = {
  "locale"          : LocaleType;
  "translations"    : TranslationsType;
  // Requires async access to Tauri API before initialization, so we also add undefined
  "fileSystem"      : GlobalStatesFileSystemType | undefined;
  "layout"          : GlobalStatesLayoutType;
  "pages"           : GlobalStatesPagesType;
  "logs"            : GlobalStatesLogsType;
  "sidebarItems"    : GlobalStatesSidebarItemsType;
  "contextMenuItems": GlobalStatesContextMenuItemsType;
  "development"     : GlobalStatesDevelopmentType;
  "misc"            : GlobalStatesMiscType;
  "minecraft"       : GlobalStatesMinecraftType;
  "instances"       : GlobalStatesMinecraftInstancesType;
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;
