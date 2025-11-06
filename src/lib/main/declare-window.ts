import * as DiscordRPC from "tauri-plugin-drpc";
import * as DiscordRPCClasses from "tauri-plugin-drpc/activity.ts";

import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";
import { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

function placeholderFunction(): void {}

export function declareWindow(): void {
  window.__TAURI_PLUGINS_COMMUNITY__ = {
    "discord": {
      ...DiscordRPC,
      ...DiscordRPCClasses,
    },
  };
  window[ApplicationNamespace] = {
    "variables": {
      "rippleColor"     : "#ffffff15",
      "sparklesColorRGB": "255 255 255",
    },
    "functions": {

      /* Fields that contain a 'placeholderFunction' will be overwritten */
      "getGlobalStates"   : placeholderFunction as () => GlobalStatesType,
      "changeGlobalStates": placeholderFunction,
      "showContextMenu"   : placeholderFunction,
      "closeContextMenu"  : placeholderFunction,
      log,
      extractError,
      getRelativeDate,
      getConfigFile,
      getDefaultConfig,
      initializeConfigFile,
    },
    "hooks": {
      "getConfigFile": {
        "before": [],
        "after" : [],
      },
      "getDefaultConfig": {
        "before": [],
        "after" : [],
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
  };
}