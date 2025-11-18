import * as DiscordRPC from "tauri-plugin-drpc";
import * as DiscordRPCClasses from "tauri-plugin-drpc/activity.ts";

import { ApplicationNamespace } from "@/constants/application.ts";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Globals from "@/lib/globals";
import Logging from "@/lib/logging";
import Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/application/config.type.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

function placeholderFunction(): void {}

export function declareWindow(): void {
  window.__TAURI_PLUGINS_COMMUNITY__ = {
    "discord": {
      ...DiscordRPC,
      ...DiscordRPCClasses,
    },
  };
  window[ApplicationNamespace] = {
    "__internals": {

      /* Fields that contain a 'placeholderFunction' will be overwritten */
      "getGlobalStates"     : placeholderFunction as () => GlobalStatesType,
      "changeGlobalStates"  : placeholderFunction,
      "getInstanceStates"   : placeholderFunction as () => InstanceStatesType,
      "changeInstanceStates": placeholderFunction,
      // This field will be overwritten too
      "initialConfig"       : {} as ConfigType,
    },
    "variables": {
      "rippleColor"     : "#ffffff15",
      "sparklesColorRGB": "255 255 255",
    },
    "libs": {
      Configs,
      Errors,
      General,
      GlobalStateHelpers,
      Globals,
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
      "getConfigFile": {
        "before": [],
        "after" : [],
      },
      "getDefaultConfig": {
        "before": [],
      },
      "onFileSystemChange": {
        "before": [],
        "after" : [],
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
      "onInstanceChange": {
        "before": [],
        "after" : [],
      },
    },
  };
}
