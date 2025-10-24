import { BaseDirectory } from "@tauri-apps/plugin-fs";

export const ApplicationName = "Kaede";
export const ApplicationNamespace = "__KAEDE__";
export const ApplicationRootID = "#app";

export const GlobalStatesContextKey = Symbol();
export const GlobalStatesChangerContextKey = Symbol();

export const ExtensionResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;

export const ConfigFilename = "config.json";

export const TreeResources = `${BaseDirectory.AppData}/resources`;
export const TreeAssets = `${TreeResources}/assets`;
export const TreeAssetIndexes = `${TreeAssets}/indexes`;
export const TreeLibraries = `${TreeResources}/libraries`;
export const TreeLogging = `${TreeResources}/logging`;
export const TreeInstances = `${BaseDirectory.AppData}/instances`;
