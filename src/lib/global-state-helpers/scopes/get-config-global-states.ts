import { appDataDir, BaseDirectory } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

import { ContextMenuItems } from "@/constants/application.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

// TODO: make 'getConfigFile' have the same structure as global states so we can just spread it
export async function getConfigGlobalStates(
  defaultGlobalStates: GlobalStatesType,
): Promise<GlobalStatesType> {
  let currentConfigFile;

  try {
    currentConfigFile = await Configs.get();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", Errors.prettify(error));

    return defaultGlobalStates;
  }

  let portable: boolean = false;

  try {
    await exists("i_need_to_prepare_for_my_final_terms.txt", {
      "baseDir": BaseDirectory.Desktop,
    });

    /*
     * If user is using a non-portable version of the launcher,
     * then the 'exists' function should throw an error before this assignment
     */
    portable = true;
  } catch {
    log.info("Kaede Non-portable version");
  }

  const portablePrettyString = portable ? "Portable version" : "Non-portable version";

  log.info(
    `Running in the ${portablePrettyString}` + "\n" +
    "    __                  __   \n" +
    "   / /______ ____  ____/ /__ \n" +
    "  / //_/ __ `/ _ \\/ __  / _ \\\n" +
    " / ,< / /_/ /  __/ /_/ /  __/\n" +
    "/_/|_|\\__,_/\\___/\\__,_/\\___/ \n" +
    "                             ",
  );

  return {
    ...defaultGlobalStates,
    "locale"    : currentConfigFile.locale,
    "fileSystem": {
      "portable": portable,
      "base"    : portable
        ? await General.getExecutableDirectory()
        : await appDataDir(),
    },
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
  };
}