import { ApplicationNamespace, ContextMenuItems } from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import { FileStructure } from "@/constants/file-structure.ts";
import { RouteItems, Routes } from "@/constants/routes.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function getConfigGlobalStates(): GlobalStatesType {
  const searchParameters = new URLSearchParams(location.search);

  /*
   * We are saving at least 30 ms by re-using already fetched config, portable and base directory.
   *
   * Initial config was provided by the 'main.ts' code
   */
  const configFile: ConfigType = window[ApplicationNamespace].__internals.initialConfig;

  log.debug("Checking if launcher is in portable version");
  // Portable status was provided by the 'main.ts' code
  const portable: boolean = window[ApplicationNamespace].__internals.initialPortable;

  log.debug("Getting base directory");
  // Base directory was provided by the 'main.ts' code
  const baseDirectory: string = window[ApplicationNamespace].__internals.initialBaseDirectory;
  const portableVersion = portable ? "Portable" : "Non-portable";

  log.info(`Running in the '${portableVersion}' version`);
  log.debug("Finishing 'getConfigGlobalStates' execution");

  return {
    ...configFile,
    "translations": EnglishTranslations,
    "fileSystem"  : {
      "portable": portable,
      "base"    : baseDirectory,
      "folders" : {
        "logs"     : General.cachedJoin(baseDirectory, FileStructure.Logs.Path),
        "instances": General.cachedJoin(baseDirectory, FileStructure.Instances.Path),
        "resources": General.cachedJoin(baseDirectory, FileStructure.Resources.Path),
      },
      "files": {
        "config": General.cachedJoin(baseDirectory, FileStructure.Config.Name),
        "log"   : General.cachedJoin(
          baseDirectory,
          FileStructure.Logs.Path,
          FileStructure.Logs.Name,
        ),
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
