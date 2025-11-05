import { vi } from "vitest";

// Overwrite 'window' object for tests only
vi.stubGlobal("window", {
  "__KAEDE__": {
    "variables": {
      "rippleColor": "",
    },
    "functions": {
      "getGlobalStates"     : (): void => {},
      "changeGlobalStates"  : (): void => {},
      "showContextMenu"     : (): void => {},
      "closeContextMenu"    : (): void => {},
      "log"                 : (): void => {},
      "extractError"        : (): void => {},
      "getRelativeDate"     : (): void => {},
      "getConfigFile"       : (): void => {},
      "getDefaultConfig"    : (): void => {},
      "initializeConfigFile": (): void => {},
    },
    "hooks": {
      "getConfigFile": {
        "before": [],
      },
      "getDefaultConfig": {
        "before": [],
      },
      "onRouteChange": {
        "before": [],
        "after" : [],
      },
      "onCustomLayoutToggle": {
        "before": [],
        "after" : [],
      },
      "onPageStatesChange": {
        "before": [],
        "after" : [],
      },
      "onLogViewerToggle": {
        "before": [],
        "after" : [],
      },
      "onSidebarItemsChange": {
        "before": [],
        "after" : [],
      },
      "onContextMenuItemsChange": {
        "before": [],
        "after" : [],
      },
    },
  },
});
// Replace 'log' function that accesses Tauri API with a mock
vi.mock("@/lib/handlers/log.ts", async () => {
  return await vi.importActual("@/__mocks__/log.cjs");
});