import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { FileStructure } from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const GlobalStatesContextKey = Symbol();
export const TranslationsContextKey = Symbol();
export const InstanceStatesContextKey = Symbol();

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

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
      window[ApplicationNamespace].libs.ContextMenu.close();
      revealItemInDir(
        General.cachedJoin(
          General.getCachedBaseDirectory(),
          FileStructure.Files.Config,
        ),
      ).catch((error: unknown) => {
        log.error("Failed to reveal the config file in the explorer:", Errors.prettify(error));
      });
    },
  },
] as const;
