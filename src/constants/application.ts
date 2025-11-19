import { BaseDirectory } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import Errors from "@/lib/errors";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const GlobalStatesContextKey = Symbol();
export const TranslationsContextKey = Symbol();
export const InstanceStatesContextKey = Symbol();

export const Permissions = {
  "Internet"            : "internet",
  "ReadInternalStorage" : "read-internal-storage",
  "ReadExternalStorage" : "read-external-storage",
  "WriteInternalStorage": "write-internal-storage",
  "WriteExternalStorage": "write-external-storage",
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
        GlobalStateHelpers.get().fileSystem?.files?.config ?? "",
      ).catch((error: unknown) => {
        log.error("Failed to reveal the config file in the explorer:", Errors.prettify(error));
      });
    },
  },
] as const;

// TODO: remove these
export const TreeResources = `${BaseDirectory.AppData}/resources`;
export const TreeAssets = `${TreeResources}/assets`;
export const TreeAssetObjects = `${TreeAssets}/objects`;
export const TreeAssetIndexes = `${TreeAssets}/indexes`;
export const TreeLibraries = `${TreeResources}/libraries`;
export const TreeNatives = `${TreeResources}/natives`;
export const TreeLogging = `${TreeResources}/logging`;
export const TreeInstances = `${BaseDirectory.AppData}/instances`;
