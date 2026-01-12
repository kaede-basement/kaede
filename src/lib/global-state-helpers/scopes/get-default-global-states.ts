import { ContextMenuItems } from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import { Routes, SidebarRouteGroupItems } from "@/constants/routes.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getDefaultGlobalStates(): GlobalStatesType {
  const searchParameters = new URLSearchParams(location.search);

  return {
    "translations": EnglishTranslations,
    "layout"      : {
      "currentInstance"        : null,
      "enableMaterialYouRipple": true,
      "custom"                 : false,
      "background"             : {
        "url"    : null,
        "key"    : null,
        "blur"   : null,
        "color"  : null,
        "isVideo": false,
      },
      "sidebar": {
        "blur"      : null,
        "color"     : null,
        "ripple"    : null,
        "sparkles"  : null,
        "background": null,
      },
      "atAGlance": {
        "title"   : null,
        "subtitle": null,
      },
    },
    "pages": {
      "current": GlobalStateHelpers.Pages.getRouteFromSearchParameters(searchParameters),
      "states" : {
        "home"        : {},
        "library"     : {},
        "settings"    : { "tab": "extensions" },
        "add-instance": {},
        "none"        : {},
      },
    },
    "logs": {
      "show"       : false,
      "lineBreaks" : false,
      "virtualized": false,
      "mode"       : "launcher",
      "filtering"  : "",
    },
    "sidebarItems": [
      ...SidebarRouteGroupItems.map(item => {
        return {
          "path"  : item.Path,
          "icon"  : item.Icon,
          "name"  : item.Path,
          "action": (): void => GlobalStateHelpers.Pages.navigate(item.Path),
        };
      }),
      "divider",
      {
        "path"  : Routes.AddInstance,
        "icon"  : "i-lucide-plus",
        "name"  : Routes.AddInstance,
        "action": (): void => GlobalStateHelpers.Pages.navigate(Routes.AddInstance),
      },
    ],
    "contextMenuItems": [...ContextMenuItems],
    "development"     : {
      "showFPS"                   : false,
      "enableDebugMode"           : false,
      "enableNativeReloadKeyBinds": false,
    },
    "extensions": {
      "enabled"                   : true,
      "allowUnrestrictedUntrusted": true,
    },
    "misc": {
      "showAfterExtensionsInitialization": false,
      "enableDiscordRPC"                 : false,
      "autoConfigSync"                   : false,
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "jvmArgs"     : "",
      "icon"        : "",
    },
  };
}
