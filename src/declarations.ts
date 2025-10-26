import type { ConfigType } from "@/types/config/config.schema.ts";
import type { log } from "@/lib/handlers/log.ts";
import type { extractError } from "@/lib/helpers/extract-error.ts";
import type { getRelativeDate } from "@/lib/helpers/get-relative-date.ts";
import type { getConfigFile } from "@/lib/main/get-config-file.ts";
import type { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import type { initializeConfigFile } from "@/lib/main/initialize-config-file.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import * as TauriApi from "@tauri-apps/api";
import * as TauriClipboardManager from "@tauri-apps/plugin-clipboard-manager";
import * as TauriDialog from "@tauri-apps/plugin-dialog";
import * as TauriFs from "@tauri-apps/plugin-fs";
import * as TauriGlobalShortcut from "@tauri-apps/plugin-global-shortcut";
import * as TauriHttp from "@tauri-apps/plugin-http";
import * as TauriNotification from "@tauri-apps/plugin-notification";
import * as TauriOs from "@tauri-apps/plugin-os";
import * as TauriProcess from "@tauri-apps/plugin-process";
import * as TauriShell from "@tauri-apps/plugin-shell";
import * as TauriUpload from "@tauri-apps/plugin-upload";
import * as TauriDiscordRpc from "tauri-plugin-drpc";
import * as TauriDiscordRpcClasses from "tauri-plugin-drpc/activity";
import type { GlobalStatesChangerType, GlobalStatesType } from "@/types/application/global-states.type.ts";

declare global {
  interface Window {
    "__TAURI__": typeof TauriApi & {
      "clipboardManager": typeof TauriClipboardManager;
      "dialog"          : typeof TauriDialog;
      "fs"              : typeof TauriFs;
      "globalShortcut"  : typeof TauriGlobalShortcut;
      "http"            : typeof TauriHttp;
      "notification"    : typeof TauriNotification;
      "os"              : typeof TauriOs;
      "process"         : typeof TauriProcess;
      "shell"           : typeof TauriShell;
      "upload"          : typeof TauriUpload;
    };
    "__TAURI_PLUGINS_COMMUNITY__": {
      "discord": typeof TauriDiscordRpc & typeof TauriDiscordRpcClasses;
    };
    "__KAEDE__": {
      "variables": {
        "rippleColor": string;
      };
      "functions": {
        "getGlobalStates"     : () => GlobalStatesType;
        "changeGlobalStates"  : GlobalStatesChangerType;
        "log"                 : typeof log;
        "extractError"        : typeof extractError;
        "getRelativeDate"     : typeof getRelativeDate;
        "getConfigFile"       : typeof getConfigFile;
        "getDefaultConfig"    : typeof getDefaultConfig;
        "initializeConfigFile": typeof initializeConfigFile;
      };
      "hooks": {
        "getConfigFile": {
          "before": HookReturnType<unknown, ConfigType>;
        };
        "getDefaultConfig": {
          "before": HookReturnType<unknown, ConfigType>;
        };
        "onRouteChange": {
          "before": HookReturnType<RouteType, RouteType, "non-promise">;
          "after" : HookReturnType<unknown, "nothing">;
        };
        "onCustomLayoutToggle": {
          "before": HookReturnType<boolean, boolean, "non-promise">;
          "after" : HookReturnType<unknown, "nothing">;
        };
        "onPageStatesChange": {
          "before": HookReturnType<unknown, unknown, "non-promise">;
          "after" : HookReturnType<RouteType, "nothing">;
        };
        "onSidebarItemsChange": {
          "before": HookReturnType<unknown, unknown, "non-promise">;
          "after" : HookReturnType<unknown, "nothing">;
        };
      };
    };
  }
}