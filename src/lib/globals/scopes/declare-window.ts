import { cancel, onInvalidUrl, onUrl, start } from "@fabianlars/tauri-plugin-oauth";
import * as DiscordRPC from "tauri-plugin-drpc";
import * as DiscordRPCClasses from "tauri-plugin-drpc/activity.ts";
import * as ShellXPlugin from "tauri-plugin-shellx-api";

import { ApplicationNamespace } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
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

export function declareWindow(): void {
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
    },
    "variables": {
      "rippleColor"     : "#ffffff15",
      "sparklesColorRGB": "255 255 255",
    },
    "libs": {
      Configs,
      DevelopmentModeHelpers,
      FileStructure,
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
      "onPageTeleportsMount": {
        "after": [],
      },
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
      "onJavaBinaryGet": {
        "before": [],
      },
    },
  };
}
