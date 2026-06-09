import { cancel, onInvalidUrl, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import * as DiscordRPC from "tauri-plugin-drpc";
import * as DiscordRPCClasses from "tauri-plugin-drpc/activity.ts";
import * as ShellXPlugin from "tauri-plugin-shellx-api";

import _Application from "@/constants/application.ts";
import _ASCIIArt from "@/constants/ascii-art.ts";
import _Browser from "@/constants/browser.ts";
import _EventListeners from "@/constants/event-listeners.ts";
import _FileStructure from "@/constants/file-structure.ts";
import _Hooks from "@/constants/hooks.ts";
import _Launcher from "@/constants/launcher.ts";
import _Meta from "@/constants/meta.ts";
import _Permissions from "@/constants/permissions.ts";
import _Routes from "@/constants/routes.ts";
import Browser from "@/lib/browser";
import Configs from "@/lib/configs";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Globals from "@/lib/globals";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import Logging from "@/lib/logging";
import Schemas from "@/lib/schemas";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

function placeholderFunction(): void {}

export function declareGlobals(): void {
  const ApplicationNamespace = _Application.ApplicationNamespace;

  window.__TAURI_PLUGINS_COMMUNITY__ = {
    "discord": {
      ...DiscordRPC,
      ...DiscordRPCClasses,
    },
    "oauth2": {
      cancel,
      onInvalidUrl,
      onUrl,
      start,
    },
    "shell": {
      ...ShellXPlugin,
    },
  };
  window[ApplicationNamespace] = {
    "__internals": {

      /* All these fields will be overwritten */
      "getGlobalStates"     : placeholderFunction as () => GlobalStatesType,
      "changeGlobalStates"  : placeholderFunction,
      "getInstanceStates"   : placeholderFunction as () => InstanceStatesType,
      "changeInstanceStates": placeholderFunction,
      "requestPermissions"  : placeholderFunction as () => Promise<Array<boolean>>,
      "syncConfig"          : placeholderFunction as () => Promise<void>,
      "joinDelimiter"       : "",
      "launcherVersion"     : "",
      "initialConfig"       : {} as ConfigType,
      "temporaryAccounts"   : [] as Array<AccountType>,
      "initialTranslations" : {} as TranslationsType,
      "initialInstances"    : {} as InstanceStatesType,
      "initialPortable"     : false,
      "initialBaseDirectory": "",
      "logsInBrowser"       : [],
    },
    "variables": {
      "rippleColor"     : "#ffffff15",
      "sparklesColorRGB": "255 255 255",
    },
    "constants": {
      "Application"   : _Application,
      "ASCIIArt"      : _ASCIIArt,
      "Browser"       : _Browser,
      "EventListeners": _EventListeners,
      "FileStructure" : _FileStructure,
      "Hooks"         : _Hooks,
      "Launcher"      : _Launcher,
      "Meta"          : _Meta,
      "Permissions"   : _Permissions,
      "Routes"        : _Routes,
    },
    "libs": {
      Browser,
      Configs,
      DevelopmentModeHelpers,
      Errors,
      ExtensionsManager,
      General,
      GlobalStateHelpers,
      Globals,
      Instances,
      Launcher,
      Logging,
      Schemas,
      "ContextMenu": {

        /* Fields that contain a 'placeholderFunction' will be overwritten */
        "show" : placeholderFunction,
        "close": placeholderFunction,
      },
      "Pages": {

        /* Fields that contain a 'placeholderFunction' will be overwritten */
        "mount"  : placeholderFunction,
        "unmount": placeholderFunction,
      },
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
        "after" : [],
      },
      "onAdditionalStartArgumentsGet": {
        "before": [],
      },
      "onLaunchArgumentsReplace": {
        "before": [],
        "after" : [],
      },
      "onMinecraftLaunch": {
        "before": [],
        "after" : [],
      },
      "onMinecraftKill": {
        "before": [],
        "after" : [],
      },
      "onMinecraftPatchResolve": {
        "before": [],
        "after" : [],
      },
    },
  };
}
