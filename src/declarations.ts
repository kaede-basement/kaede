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
import type { RouteType } from "@/types/application/route.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

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
     * Application namespace.
     *
     * Extensions can extend this namespace
     */
    "__KAEDE__": {

      /**
       * Workarounds for application internals.
       *
       * Should not be modified by extensions
       */
      "__internals": {
        // Gets current application's global states (use 'libs.GlobalStateHelpers#get')
        "getGlobalStates"      : () => GlobalStatesType;
        // Changes application's global states (use 'libs.GlobalStateHelpers#change')
        "changeGlobalStates"   : GlobalStatesChangerType;
        // Application's config state before launcher initialization
        "initialConfig"        : ConfigType;
        // Application's portable state before launcher initialization
        "initialPortable"     ?: boolean;
        // Application's base directory state before launcher initialization
        "initialBaseDirectory"?: string;
      };

      /**
       * Global utilities.
       *
       * Changing any field of the listed objects
       * will alter behaviour of that field for everyone.
       *
       * Example:
       *
       * ```ts
       * // Somewhere in a plugin
       * const arrayInADifferentScope: Array<unknown> = [];
       *
       * function customDebugFunction(...input: Array<unknown>): void {
       *   arrayInADifferentScope.push(input);
       * };
       *
       * // This assignment overwrites the 'debug' field in the 'log' object
       * // with a reference to the 'customDebugFunction' function,
       * // so all upcoming 'log#debug' calls will use the 'customDebugFunction' function
       * // even if calls were not made via accessing the 'window' object
       * window[ApplicationNamespace].libs.Logging.log.debug = customDebugFunction;
       * ```
       */
      "libs": {

        /**
         * Launcher's configuration-related collection of utilities
         */
        "Configs": typeof Configs;

        /**
         * Launcher's errors-related collection of utilities
         */
        "Errors": typeof Errors;

        /**
         * Launcher's general-purpose collection of utilities
         */
        "General": typeof General;

        /**
         * Launcher's global states related collection of utilities
         */
        "GlobalStateHelpers": typeof GlobalStateHelpers;

        /**
         * Launcher's 'window' object related collection of utilities
         */
        "Globals": typeof Globals;

        /**
         * Launcher's logging-related collection of utilities
         */
        "Logging": typeof Logging;

        /**
         * Launcher's collection of typebox validation schemas
         */
        "Schemas": typeof Schemas;

        /**
         * Launcher's context menu related collection of utilities
         */
        "ContextMenu": {

          /*
           * Shows context menu. Requires the 'MouseEvent' typed event
           * as the argument, since the context menu dynamically calculates
           * its absolute position in the DOM by reading the provided event
           */
          "show" : (event: MouseEvent) => void;
          // Hides context menu
          "close": () => void;
        };

        /**
         * Launcher's pages-related collection of utilities
         */
        "Pages": {
          // Teleports the specified page to an element with the provided selector
          "mount"  : (page: Exclude<RouteType, "none">, id: string) => void;
          // Removes the specified page from DOM
          "unmount": (page: Exclude<RouteType, "none">) => void;
        };
      };

      /**
       * Global variables that are allowed to be changed by plugins
       */
      "variables": {
        // Applies a background color to the ripple effect
        "rippleColor"     : string;
        // Applies a sparkles color to the ripple effect
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
           * Executes 'async' or 'sync' functions before the config was read.
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
           * Executes 'async' or 'sync' functions after the config was read, parsed, and validated.
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

        /**
         * Executed on the default config retrieve
         */
        "getDefaultConfig": {

          /**
           * Executes 'async' or 'sync' functions before the default config was returned.
           *
           * No arguments.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'ConfigType' typed object in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<unknown, ConfigType>;
        };

        /**
         * Executed on the translations replacement in global states
         */
        "onTranslationsChange": {

          /**
           * Executes 'sync'-only functions before the 'translations' property
           * in the global states will change.
           *
           * 'TranslationsType' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'TranslationsType' typed object in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<TranslationsType, TranslationsType, "non-promise">;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'translations' property in the global states has changed.
           *
           * 'TranslationsType' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<TranslationsType, "nothing">;
        };

        /**
         * Executed on the 'fileSystem' field replacement in global states
         */
        "onFileSystemChange": {

          /**
           * Executes 'sync'-only functions before the 'fileSystem' property
           * in the global states will change.
           *
           * 'GlobalStatesType["fileSystem"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["fileSystem"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["fileSystem"],
            GlobalStatesType["fileSystem"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'fileSystem' property in the global states has changed.
           *
           * 'GlobalStatesType["fileSystem"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["fileSystem"], "nothing">;
        };

        /**
         * Executed on the 'layout' field replacement in global states
         */
        "onLayoutChange": {

          /**
           * Executes 'sync'-only functions before the 'layout' property
           * in the global states will change.
           *
           * 'GlobalStatesType["layout"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["layout"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["layout"],
            GlobalStatesType["layout"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'layout' property in the global states has changed.
           *
           * 'GlobalStatesType["layout"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["layout"], "nothing">;
        };

        /**
         * Executed on the 'pages' field replacement in global states
         */
        "onPagesChange": {

          /**
           * Executes 'sync'-only functions before the 'pages' property
           * in the global states will change.
           *
           * 'GlobalStatesType["pages"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["pages"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["pages"],
            GlobalStatesType["pages"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'pages' property in the global states has changed.
           *
           * 'GlobalStatesType["pages"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["pages"], "nothing">;
        };

        /**
         * Executed on the 'logs' field replacement in global states
         */
        "onLogsChange": {

          /**
           * Executes 'sync'-only functions before the 'logs' property
           * in the global states will change.
           *
           * 'GlobalStatesType["logs"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["logs"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["logs"],
            GlobalStatesType["logs"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'logs' property in the global states has changed.
           *
           * 'GlobalStatesType["logs"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["logs"], "nothing">;
        };

        /**
         * Executed on the 'sidebarItems' field replacement in global states
         */
        "onSidebarItemsChange": {

          /**
           * Executes 'sync'-only functions before the 'sidebarItems' property
           * in the global states will change.
           *
           * 'GlobalStatesType["sidebarItems"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["sidebarItems"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["sidebarItems"],
            GlobalStatesType["sidebarItems"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'sidebarItems' property in the global states has changed.
           *
           * 'GlobalStatesType["sidebarItems"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["sidebarItems"], "nothing">;
        };

        /**
         * Executed on the 'contextMenuItems' field replacement in global states
         */
        "onContextMenuItemsChange": {

          /**
           * Executes 'sync'-only functions before the 'contextMenuItems' property
           * in the global states will change.
           *
           * 'GlobalStatesType["contextMenuItems"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["contextMenuItems"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["contextMenuItems"],
            GlobalStatesType["contextMenuItems"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'contextMenuItems' property in the global states has changed.
           *
           * 'GlobalStatesType["contextMenuItems"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["contextMenuItems"], "nothing">;
        };

        /**
         * Executed on the 'development' field replacement in global states
         */
        "onDevelopmentChange": {

          /**
           * Executes 'sync'-only functions before the 'development' property
           * in the global states will change.
           *
           * 'GlobalStatesType["development"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["development"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["development"],
            GlobalStatesType["development"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'development' property in the global states has changed.
           *
           * 'GlobalStatesType["development"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["development"], "nothing">;
        };

        /**
         * Executed on the 'misc' field replacement in global states
         */
        "onMiscChange": {

          /**
           * Executes 'sync'-only functions before the 'misc' property
           * in the global states will change.
           *
           * 'GlobalStatesType["misc"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["misc"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["misc"],
            GlobalStatesType["misc"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'misc' property in the global states has changed.
           *
           * 'GlobalStatesType["misc"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["misc"], "nothing">;
        };

        /**
         * Executed on the 'minecraft' field replacement in global states
         */
        "onMinecraftChange": {

          /**
           * Executes 'sync'-only functions before the 'minecraft' property
           * in the global states will change.
           *
           * 'GlobalStatesType["minecraft"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["minecraft"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["minecraft"],
            GlobalStatesType["minecraft"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'minecraft' property in the global states has changed.
           *
           * 'GlobalStatesType["minecraft"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["minecraft"], "nothing">;
        };

        /**
         * Executed on the 'instances' field replacement in global states
         */
        "onInstancesChange": {

          /**
           * Executes 'sync'-only functions before the 'instances' property
           * in the global states will change.
           *
           * 'GlobalStatesType["instances"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["instances"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["instances"],
            GlobalStatesType["instances"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'instances' property in the global states has changed.
           *
           * 'GlobalStatesType["instances"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["instances"], "nothing">;
        };
      };
    };
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = Window["__KAEDE__"];
