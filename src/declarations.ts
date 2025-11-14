import * as TauriApi from "@tauri-apps/api";
import * as TauriDialog from "@tauri-apps/plugin-dialog";
import * as TauriFs from "@tauri-apps/plugin-fs";
import * as TauriHttp from "@tauri-apps/plugin-http";
import * as TauriNotification from "@tauri-apps/plugin-notification";
import * as TauriOs from "@tauri-apps/plugin-os";
import * as TauriProcess from "@tauri-apps/plugin-process";
import * as TauriShell from "@tauri-apps/plugin-shell";
import * as TauriUpload from "@tauri-apps/plugin-upload";
import * as TauriDiscordRpc from "tauri-plugin-drpc";
import * as TauriDiscordRpcClasses from "tauri-plugin-drpc/activity";

import type Configs from "@/lib/configs";
import type Errors from "@/lib/errors";
import type General from "@/lib/general";
import type GlobalStateHelpers from "@/lib/global-state-helpers";
import type Globals from "@/lib/globals";
import type Logging from "@/lib/logging";
import type Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/application/config.type.ts";
import type {
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { LocaleType } from "@/types/application/locale.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";

/* Expand the globals with Kaede and Tauri namespaces */
declare global {

  /* Declared in the '@/lib/globals/scopes/declare-window.ts' */
  interface Window {

    /* Tauri exposes these */
    "__TAURI__": typeof TauriApi & {
      "dialog"      : typeof TauriDialog;
      "fs"          : typeof TauriFs;
      "http"        : typeof TauriHttp;
      "notification": typeof TauriNotification;
      "os"          : typeof TauriOs;
      "process"     : typeof TauriProcess;
      "shell"       : typeof TauriShell;
      "upload"      : typeof TauriUpload;
    };

    /* Tauri community plugins */
    "__TAURI_PLUGINS_COMMUNITY__": {
      "discord": typeof TauriDiscordRpc & typeof TauriDiscordRpcClasses;
    };

    /**
     * Application namespace
     */
    "__KAEDE__": {

      "__internals": {
        "getGlobalStates"      : () => GlobalStatesType;
        "changeGlobalStates"   : GlobalStatesChangerType;
        "initialConfig"        : ConfigType;
        "initialPortable"     ?: boolean;
        "initialBaseDirectory"?: string;
      };

      /**
       * Global utilities
       */
      "libs": {
        "Configs"           : typeof Configs;
        "Errors"            : typeof Errors;
        "General"           : typeof General;
        "GlobalStateHelpers": typeof GlobalStateHelpers;
        "Globals"           : typeof Globals;
        "Logging"           : typeof Logging;
        "Schemas"           : typeof Schemas;
        "ContextMenu"       : {
          "show" : (event: MouseEvent) => void;
          "close": () => void;
        };
      };

      /**
       * Global variables that are allowed to be changed by plugins
       */
      "variables": {
        "rippleColor"     : string;
        "sparklesColorRGB": string;
      };

      /**
       * Application hooks
       */
      "hooks": {

        /**
         * Executed on the config retrieve
         */
        "getConfigFile": {

          /**
           * Executed before the config was read.
           *
           * Absolute pathname of the config file is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'ConfigType' typed object in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<string, ConfigType>;

          /**
           * Executed after the config was read, parsed, and validated.
           *
           * A validated config is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'ConfigType' typed object in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * it may add properties to the passed config argument or do nothing.
           */
          "after": HookReturnType<ConfigType, ConfigType>;
        };
        "getDefaultConfig": {
          "before": HookReturnType<unknown, ConfigType>;
          "after" : HookReturnType<ConfigType, ConfigType>;
        };
        "onLocaleChange": {
          "before": HookReturnType<LocaleType, LocaleType, "non-promise">;
          "after" : HookReturnType<LocaleType, "nothing">;
        };
        "onFileSystemChange": {
          "before": HookReturnType<
            GlobalStatesType["fileSystem"],
            GlobalStatesType["fileSystem"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["fileSystem"], "nothing">;
        };
        "onLayoutChange": {
          "before": HookReturnType<
            GlobalStatesType["layout"],
            GlobalStatesType["layout"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["layout"], "nothing">;
        };
        "onPagesChange": {
          "before": HookReturnType<
            GlobalStatesType["pages"],
            GlobalStatesType["pages"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["pages"], "nothing">;
        };
        "onLogsChange": {
          "before": HookReturnType<
            GlobalStatesType["logs"],
            GlobalStatesType["logs"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["logs"], "nothing">;
        };
        "onSidebarItemsChange": {
          "before": HookReturnType<
            GlobalStatesType["sidebarItems"],
            GlobalStatesType["sidebarItems"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["sidebarItems"], "nothing">;
        };
        "onContextMenuItemsChange": {
          "before": HookReturnType<
            GlobalStatesType["contextMenuItems"],
            GlobalStatesType["contextMenuItems"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["contextMenuItems"], "nothing">;
        };
        "onDevelopmentChange": {
          "before": HookReturnType<
            GlobalStatesType["development"],
            GlobalStatesType["development"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["development"], "nothing">;
        };
        "onMiscChange": {
          "before": HookReturnType<
            GlobalStatesType["misc"],
            GlobalStatesType["misc"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["misc"], "nothing">;
        };
        "onMinecraftChange": {
          "before": HookReturnType<
            GlobalStatesType["minecraft"],
            GlobalStatesType["minecraft"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["minecraft"], "nothing">;
        };
        "onInstancesChange": {
          "before": HookReturnType<
            GlobalStatesType["instances"],
            GlobalStatesType["instances"],
            "non-promise"
          >;
          "after": HookReturnType<GlobalStatesType["instances"], "nothing">;
        };
      };
    };
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = Window["__KAEDE__"];
