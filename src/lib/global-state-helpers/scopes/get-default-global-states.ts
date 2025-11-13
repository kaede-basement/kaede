import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getDefaultGlobalStates(): GlobalStatesType {
  return {
    "locale"    : "en",
    "fileSystem": undefined,
    "layout"    : {
      "custom"    : false,
      "background": {
        "url"  : undefined,
        "key"  : undefined,
        "blur" : undefined,
        "color": undefined,
      },
      "sidebar": {
        "blur"      : undefined,
        "color"     : undefined,
        "ripple"    : undefined,
        "sparkles"  : undefined,
        "background": undefined,
      },
    },
    "pages": {
      "current": Routes.Home,
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
      "dates"      : false,
      "filtering"  : "",
    },
    "sidebarItems": [
      ...RouteItems.map(item => {
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
      "enabled"                   : false,
      "showFPS"                   : false,
      "enableDebugMode"           : false,
      "enableNativeReloadKeyBinds": false,
    },
  };
}
