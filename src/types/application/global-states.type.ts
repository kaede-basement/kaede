import type { ShallowReactive } from "vue";

import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export type GlobalStatesLayoutType = {
  "locale"                 : string;
  "stats"                  : "playtime" | "last-launch";
  "currentInstance"        : string | null;
  "enableMaterialYouRipple": boolean;
  "custom"                 : boolean | Array<"sidebar" | "contextMenu">;
  "background"             : {
    "url"    : string | null;
    "key"    : string | number | null;
    "blur"   : number | null;
    "color"  : string | null;
    "isVideo": boolean;
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
      // TODO: something
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
      "instanceVersionSearch": {
        "patch": ExtendedPatchUIDType;
        "input": string;
      };
      "instance": {
        "name"         : string;
        "entry"        : ExtendedPatchUIDType;
        "checksum"     : boolean;
        "groups"       : Array<string>;
        "javaBinary"   : string;
        "patchVersions": InstanceStateType["patchVersions"];
        "windowHeight" : number;
        "windowWidth"  : number;
        "icon"        ?: string;
        "add"          : {
          "jvmArguments": Array<string>;
        };
      };
      "tab": string;
    }>;
    // Reserved for extensions' needs
    "none": Record<string, unknown>;
  };
};
export type GlobalStatesLogsType = {
  "show"       : boolean;
  "lineBreaks" : boolean;
  "virtualized": boolean;
  "mode"       : "launcher" | string;
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
  "name"  : string;
  "action": () => void;
  "icon" ?: string;
  "image"?: string;
}>;
export type GlobalStatesDevelopmentType = {
  "showFPS"                   : boolean;
  "enableDebugMode"           : boolean;
  "enableNativeContextMenu"   : boolean;
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
  "icon"        : string;
  "javaBinary"  : string;
  "add"         : Partial<{
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  }>;
  "remove": Partial<{
    "jvmArguments" : Array<string>;
    "gameArguments": Array<string>;
  }>;
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
};
export type GlobalStatesChangerType = <Key extends keyof GlobalStatesType>(
  key  : Key,
  value: GlobalStatesType[Key],
) => void;
export type ContextGlobalStatesType = ShallowReactive<GlobalStatesType>;
