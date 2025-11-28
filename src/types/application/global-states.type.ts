import type { ShallowReactive } from "vue";

import type { RouteType } from "@/types/application/route.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export type GlobalStatesFileSystemType = {
  "portable": boolean;
  "base"    : string;
  "folders" : {
    "logs"      : string;
    "instances" : string;
    "resources" : string;
    "extensions": string;
  };
  "files": {
    "config": string;
    "log"   : string;
  };
};
export type GlobalStatesLayoutType = {
  "custom"    : boolean | Array<"sidebar" | "contextMenu">;
  "background": {
    "url"  : string | null;
    "key"  : string | number | null;
    "blur" : number | null;
    "color": string | null;
  };
  "sidebar": {
    "blur"      : number | null;
    "color"     : string | null;
    "ripple"    : string | null;
    "sparkles"  : string | null;
    "background": string | null;
  };
  "atAGlance": {
    "title"   : string | null;
    "subtitle": string | null;
  };
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
  "showFPS"                   : boolean;
  "enableDebugMode"           : boolean;
  "enableNativeReloadKeyBinds": boolean;
};
export type GlobalStatesMiscType = {
  "showAfterExtensionsInitialization": boolean;
  "enableDiscordRPC"                 : boolean;
  "autoConfigSync"                   : boolean;
};
// Global minecraft settings
export type GlobalStatesMinecraftType = {
  "windowHeight": number;
  "windowWidth" : number;
  "jvmArgs"     : string;
  "icon"        : string;
};
export type GlobalStatesExtensionsType = {
  "enabled"                   : boolean;
  "allowUnrestrictedUntrusted": boolean;
};

export type GlobalStatesType = {

  /*
   * Specified in config (only JSON values)
   *
   * JSON doesn't have 'undefined' value, so we use 'null' instead of it
   */
  "development": GlobalStatesDevelopmentType | null;
  "extensions" : GlobalStatesExtensionsType;
  "layout"     : GlobalStatesLayoutType;
  "logs"       : GlobalStatesLogsType;
  "misc"       : GlobalStatesMiscType;
  "minecraft"  : GlobalStatesMinecraftType;

  // Not specified in config (non-JSON values)
  "translations"    : TranslationsType;
  "sidebarItems"    : GlobalStatesSidebarItemsType;
  "contextMenuItems": GlobalStatesContextMenuItemsType;
  "pages"           : GlobalStatesPagesType;
  "fileSystem"      : GlobalStatesFileSystemType | undefined;
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;
