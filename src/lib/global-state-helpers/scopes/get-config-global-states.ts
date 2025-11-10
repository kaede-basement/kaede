import { appDataDir, join } from "@tauri-apps/api/path";

import { ContextMenuItems } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
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

  log.debug("Checking if launcher is in portable version");
  const portable: boolean = await General.checkIsPortable();

  log.debug("Getting base directory");
  const baseDirectory = portable
    ? await General.getExecutableDirectory()
    : await appDataDir();
  const portableVersion = portable ? "Portable version" : "Non-portable version";

  log.info(
    `Running in the ${portableVersion}` + "\n" +
    "    __                  __   \n" +
    "   / /______ ____  ____/ /__ \n" +
    "  / //_/ __ `/ _ \\/ __  / _ \\\n" +
    " / ,< / /_/ /  __/ /_/ /  __/\n" +
    "/_/|_|\\__,_/\\___/\\__,_/\\___/ \n" +
    "                             ",
  );
  log.debug("Finishing 'getConfigGlobalStates' execution");

  return {
    ...defaultGlobalStates,
    "locale"    : currentConfigFile.locale,
    "fileSystem": {
      "portable": portable,
      "base"    : baseDirectory,
      "folders" : {
        "logs"     : await join(baseDirectory, FileStructure.Logs.Path),
        "instances": await join(baseDirectory, FileStructure.Instances.Path),
        "resources": await join(baseDirectory, FileStructure.Resources.Path),
      },
      "files": {
        "config": await join(baseDirectory, FileStructure.Config.Name),
        "log"   : await join(baseDirectory, FileStructure.Logs.Path, FileStructure.Logs.Name),
      },
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