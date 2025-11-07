import { BaseDirectory } from "@tauri-apps/plugin-fs";

import GlobalStateHelpers from "@/lib/global-state-helpers";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const GlobalStatesContextKey = Symbol();

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
