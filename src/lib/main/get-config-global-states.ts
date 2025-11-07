import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";
import { PagesStateHelper } from "@/lib/helpers/global-state-helpers.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import { getDefaultGlobalStates } from "@/lib/main/get-default-global-states.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export async function getConfigGlobalStates(): Promise<GlobalStatesType> {
  let currentConfigFile;

  try {
    currentConfigFile = await getConfigFile();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", JSON.stringify(extractError(error)));

    return getDefaultGlobalStates();
  }

  return {
    "locale": currentConfigFile.locale,
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