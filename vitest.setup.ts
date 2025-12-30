import { vi } from "vitest";

import type { KaedeNamespaceType } from "./src/declarations";
import type { InstanceStatesType } from "./src/types/application/instance-states.type";
import type { AccountType } from "./src/types/configs/account.type";
import type { TranslationsType } from "./src/types/translations/translations.type";

// Overwrite the 'window' object for tests only
vi.stubGlobal("window", {
  "__KAEDE__": {
    "__internals": {
      "getGlobalStates"     : (): void => {},
      "changeGlobalStates"  : (): void => {},
      "getInstanceStates"   : (): void => {},
      "changeInstanceStates": (): void => {},
      "requestPermissions"  : async (): Promise<Array<boolean>> => ([]),
      "syncConfig"          : async (): Promise<void> => {},
      "joinDelimiter"       : "",
      "launcherVersion"     : "",
      "initialPortable"     : false,
      "initialBaseDirectory": "",
      "initialConfig"       : {},
      "temporaryAccounts"   : [] as Array<AccountType>,
      "initialTranslations" : {} as TranslationsType,
      "initialInstances"    : {} as InstanceStatesType,
    },
    "variables": {
      "rippleColor"     : "",
      "sparklesColorRGB": "255 255 255",
    },
    "hooks": {
      "onConfigFileGet": {
        "before": [],
        "after" : [],
      },
      "onDefaultConfigGet": {
        "before": [],
      },
      "onPagesChange": {
        "before": [],
        "after" : [],
      },
      "onLayoutChange": {
        "before": [],
        "after" : [],
      },
      "onLogsChange": {
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
      "onDevelopmentChange": {
        "before": [],
        "after" : [],
      },
      "onMiscChange": {
        "before": [],
        "after" : [],
      },
      "onMinecraftChange": {
        "before": [],
        "after" : [],
      },
      "onTranslationsChange": {
        "before": [],
        "after" : [],
      },
      "onExtensionsChange": {
        "before": [],
        "after" : [],
      },
      "onInstanceChange": {
        "before": [],
        "after" : [],
      },
      "onPreLaunchInformation": {
        "before": [],
        "after" : [],
      },
      "onVersionMeta": {
        "before": [],
        "after" : [],
      },
      "onLibrariesParsing": {
        "before": [],
        "after" : [],
      },
      "onMinecraftAssetsGet": {
        "before": [],
        "after" : [],
      },
      "onMinecraftPatchesGet": {
        "before": [],
        "after" : [],
      },
      "onMinecraftClientGet": {
        "before": [],
        "after" : [],
      },
      "onMinecraftLoggingGet": {
        "before": [],
        "after" : [],
      },
      "onMinecraftLibrariesGet": {
        "before": [],
        "after" : [],
      },
      "onNativesExtract": {
        "before": [],
        "after" : [],
      },
      "onJavaBinaryGet": {
        "before": [],
      },
      "onJVMArgumentsGet": {
        "before": [],
        "after" : [],
      },
      "onClassPathsGet": {
        "before": [],
      },
      "onGameArgumentsGet": {
        "before": [],
      },
      "onAdditionalStartArgumentsGet": {
        "before": [],
      },
      "onLaunchArgumentsReplace": {
        "before": [],
        "after" : [],
      },
    },
  },
} satisfies {

  /*
   * Kaede itself uses only the "__internals", "variables", and "hooks" properties.
   * The remaining fields provide access to the Kaede utilities for plugin developers.
   */
  "__KAEDE__": Pick<
    KaedeNamespaceType,
    "__internals" | "variables" | "hooks"
  >;
});

// Mock the logging utilities
vi.mock("@/lib/logging/scopes/log.ts", async () => {
  return await vi.importActual("@/__mocks__/log.cjs");
});

// Mock Tauri APIs
vi.mock("@tauri-apps/api/window", async () => {
  const mockedWindow: typeof window.__TAURI__.window = {
    "getCurrentWindow": () => ({
      "theme": async () => "dark",
    }),
  } as typeof window.__TAURI__.window;

  return mockedWindow;
});
