import { join } from "@tauri-apps/api/path";

import { ApplicationNamespace, ContextMenuItems } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import Configs from "@/lib/configs";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

// TODO: make 'getConfigFile' have the same structure as global states so we can just spread it
export async function getConfigGlobalStates(
  defaultGlobalStates: GlobalStatesType,
  fresh?: boolean,
): Promise<GlobalStatesType> {
  /*
   * We are saving at least 30 ms by re-using already fetched config, portable and base directory.
   *
   * Initial config was provided by the 'main.ts' code
   */
  let currentConfigFile: ConfigType = window[ApplicationNamespace].__internals.initialConfig;

  log.debug("Checking if launcher is in portable version");
  // Portable status was provided by the 'main.ts' code
  const portable: boolean = window[ApplicationNamespace].__internals.initialPortable
    // Unless it was not?
    ?? await General.checkIsPortable();

  log.debug("Getting base directory");
  // Base directory was provided by the 'main.ts' code
  const baseDirectory = window[ApplicationNamespace].__internals.initialBaseDirectory
    // Unless it was not?
    ?? await General.getBaseDirectory(portable);

  if (fresh) {
    log.debug("Getting a fresh copy of config since the 'fresh' state is:", fresh.toString());
    currentConfigFile = await Configs.getSafe(baseDirectory);
  }

  const portableVersion = portable ? "Portable" : "Non-portable";

  log.info(`Running in the '${portableVersion}' version`);
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
    "misc": {
      "showBeforeInitialization": false,
      "enableDiscordRPC"        : false,
    },
    "minecraft": {
      "windowHeight": 480,
      "windowWidth" : 854,
      "jvmArgs"     : "",
    },
    "instances": {},
  };
}
