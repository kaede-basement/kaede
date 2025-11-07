import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";
import { PagesStateHelper } from "@/lib/helpers/global-state-helpers.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

// TODO: make 'getConfigFile' have the same structure as global states so we can just spread it
export async function getConfigGlobalStates(
  defaultGlobalStates: GlobalStatesType,
): Promise<GlobalStatesType> {
  let currentConfigFile;

  try {
    currentConfigFile = await getConfigFile();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", JSON.stringify(extractError(error)));

    return defaultGlobalStates;
  }

  return {
    ...defaultGlobalStates,
    "locale": currentConfigFile.locale,
    "layout": {
      ...defaultGlobalStates.layout,
      "custom": false,
    },
    "pages": {
      ...defaultGlobalStates.pages,
      "current": Routes.Home,
      "states" : {
        ...defaultGlobalStates.pages.states,
        "home"        : {},
        "library"     : {},
        "settings"    : { "tab": "extensions" },
        "add-instance": {},
        "none"        : {},
      },
    },
    "logs": {
      ...defaultGlobalStates.logs,
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