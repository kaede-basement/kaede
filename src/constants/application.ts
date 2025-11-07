import { BaseDirectory } from "@tauri-apps/plugin-fs";

import GlobalStateHelpers from "@/lib/helpers/global-state-helpers.ts";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const GlobalStatesContextKey = Symbol();

export const ExtensionResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
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
      GlobalStateHelpers.Logs.Toggle("show", true);
      window[ApplicationNamespace].functions.closeContextMenu();
    },
  },
] as const;

export const ConfigFilename = "config.json";

export const TreeResources = `${BaseDirectory.AppData}/resources`;
export const TreeAssets = `${TreeResources}/assets`;
export const TreeAssetObjects = `${TreeAssets}/objects`;
export const TreeAssetIndexes = `${TreeAssets}/indexes`;
export const TreeLibraries = `${TreeResources}/libraries`;
export const TreeNatives = `${TreeResources}/natives`;
export const TreeLogging = `${TreeResources}/logging`;
export const TreeInstances = `${BaseDirectory.AppData}/instances`;
