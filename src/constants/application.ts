import { revealItemInDir } from "@tauri-apps/plugin-opener";

import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import ATLauncherIcon from "@/resources/ATLauncherIcon.svg";
import CraftingTableIcon from "@/resources/CraftingTableIcon.webp";
import CurseForgeIcon from "@/resources/CurseForgeIcon.webp";
import FTBIcon from "@/resources/FTBIcon.svg";
import ModrinthIcon from "@/resources/ModrinthIcon.webp";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const DefaultLocale = "en";

export const GlobalStatesContextKey = Symbol();
export const TranslationsContextKey = Symbol();
export const InstanceStatesContextKey = Symbol();
export const AuthStatesContextKey = Symbol();
export const LaunchStatesContextKey = Symbol();
export const InstanceLogsContextKey = Symbol();
export const LaunchInstanceContextKey = Symbol();
export const CloseInstanceContextKey = Symbol();

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

export const InstanceCreationSections: Array<{
  "id"     : string;
  "name"   : string;
  "image"  : string;
  "action"?: (id: string) => Promise<void>;
}> = [
  {
    "id"   : "clean-minecraft",
    "name" : "Clean",
    "image": CraftingTableIcon,
  },
  {
    "id"   : "modrinth",
    "name" : "Modrinth",
    "image": ModrinthIcon,
  },
  {
    "id"   : "ftb-legacy",
    "name" : "FTB Legacy",
    "image": FTBIcon,
  },
  {
    "id"   : "curseforge",
    "name" : "CurseForge",
    "image": CurseForgeIcon,
  },
  {
    "id"   : "atlauncher",
    "name" : "ATLauncher",
    "image": ATLauncherIcon,
  },
];
export const ContextMenuItems = [
  {
    "name"  : "Restart UI",
    "icon"  : "i-lucide-rotate-ccw",
    "action": (): void => window.location.reload(),
  },
  {
    "name"  : "Show Logs",
    "icon"  : "i-lucide-bug",
    "action": (): void => {
      GlobalStateHelpers.Logs.toggle("show", true);
      window[ApplicationNamespace].libs.ContextMenu.close();
    },
  },
  {
    "name"  : "Open Root Folder",
    "icon"  : "i-lucide-folder",
    "action": (): void => {
      const baseDirectory: string = General.getCachedBaseDirectory();

      window[ApplicationNamespace].libs.ContextMenu.close();
      revealItemInDir(
        General.cachedJoin(
          baseDirectory,
          FileStructure.Files.Config,
        ),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the config file in the explorer:",
          Errors.prettify(error),
        );

        revealItemInDir(
          General.cachedJoin(baseDirectory),
        ).catch((error: unknown) => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(error),
          );
        });
      });
    },
  },
  {
    "name"  : "Open Instance Folder",
    "icon"  : "i-lucide-box",
    "action": (): void => {
      const currentInstanceId: string | null = GlobalStateHelpers.get().layout.currentInstance;
      const baseDirectory: string = General.getCachedBaseDirectory();

      window[ApplicationNamespace].libs.ContextMenu.close();

      if (!currentInstanceId) {
        log.warn("No instance selected; revealing the root directory in explorer");
        revealItemInDir(
          General.cachedJoin(
            baseDirectory,
            FileStructure.Folders.Instances.Path,
          ),
        ).catch((error: unknown) => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            "Failed to reveal the root directory in the explorer:",
            Errors.prettify(error),
          );
        });

        return;
      }

      const minecraftDirectory: string = Instances.getMinecraftDirectory({
        "baseDirectory": baseDirectory,
        "instanceId"   : currentInstanceId,
      });

      revealItemInDir(
        General.cachedJoin(minecraftDirectory),
      ).catch((error: unknown) => {
        log.error(
          __PRE_BUNDLED_FILENAME__,
          "Failed to reveal the instance directory in the explorer:",
          Errors.prettify(error),
        );
      });
    },
  },
] as const;
