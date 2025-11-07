import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import { PagesStateHelper } from "@/lib/helpers/global-state-helpers.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getDefaultGlobalStates(): GlobalStatesType {
  return {
    "locale": "en",
    "layout": {
      "custom": false,
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
    },
    "sidebarItems": [
      ...RouteItems.map(item => {
        return {
          "path"  : item.Path,
          "icon"  : item.Icon,
          "name"  : item.Path,
          "action": (): void => PagesStateHelper.Navigate(item.Path),
        };
      }),
      "divider",
      {
        "path"  : Routes.AddInstance,
        "icon"  : "i-lucide-plus",
        "name"  : "Add Instance",
        "action": (): void => PagesStateHelper.Navigate(Routes.AddInstance),
      },
    ],
    "contextMenuItems": [...ContextMenuItems],
  };
}