import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import { getConfigFile } from "@/lib/configs/scopes/get-config-file.ts";
import Errors from "@/lib/errors";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

// TODO: make 'getConfigFile' have the same structure as global states so we can just spread it
export async function getConfigGlobalStates(
  defaultGlobalStates: GlobalStatesType,
): Promise<GlobalStatesType> {
  let currentConfigFile;

  try {
    currentConfigFile = await getConfigFile();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", JSON.stringify(Errors.extract(error)));

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
  };
}