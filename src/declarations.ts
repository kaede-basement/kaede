import * as TauriOAuth2 from "@fabianlars/tauri-plugin-oauth";
import * as TauriApi from "@tauri-apps/api";
import * as TauriDialog from "@tauri-apps/plugin-dialog";
import * as TauriFs from "@tauri-apps/plugin-fs";
import * as TauriHttp from "@tauri-apps/plugin-http";
import * as TauriNotification from "@tauri-apps/plugin-notification";
import * as TauriOpener from "@tauri-apps/plugin-opener";
import * as TauriOs from "@tauri-apps/plugin-os";
import * as TauriProcess from "@tauri-apps/plugin-process";
import * as TauriShell from "@tauri-apps/plugin-shell";
import * as TauriUpload from "@tauri-apps/plugin-upload";
import * as TauriDiscordRpc from "tauri-plugin-drpc";
import * as TauriDiscordRpcClasses from "tauri-plugin-drpc/activity";

import type { FileStructure } from "@/constants/file-structure.ts";
import type Configs from "@/lib/configs";
import type DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import type Errors from "@/lib/errors";
import type ExtensionsManager from "@/lib/extensions-manager";
import type General from "@/lib/general";
import type GlobalStateHelpers from "@/lib/global-state-helpers";
import type Globals from "@/lib/globals";
import type Instances from "@/lib/instances";
import type Launcher from "@/lib/launcher";
import type Logging from "@/lib/logging";
import type Schemas from "@/lib/schemas";
import type {
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStatesChangerType,
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";
import type { AtAGlanceType } from "@/types/misc/at-a-glance.type.ts";
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
      "opener"      : typeof TauriOpener;
      "os"          : typeof TauriOs;
      "process"     : typeof TauriProcess;
      "shell"       : typeof TauriShell;
      "upload"      : typeof TauriUpload;
    };

    /* Tauri community plugins */
    "__TAURI_PLUGINS_COMMUNITY__": {
      "discord": typeof TauriDiscordRpc & typeof TauriDiscordRpcClasses;
      "oauth2" : typeof TauriOAuth2;
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
       * These fields are not intended to be modified by extensions
       */
      "__internals": {
        // Gets current application's global states (use 'libs.GlobalStateHelpers#get')
        "getGlobalStates"     : () => GlobalStatesType;
        // Changes application's global states (use 'libs.GlobalStateHelpers#change')
        "changeGlobalStates"  : GlobalStatesChangerType;
        // Gets current application's instance states (use 'libs.Instances#get')
        "getInstanceStates"   : () => InstanceStatesType;
        // Changes application's instance states (use 'libs.Instances#change')
        "changeInstanceStates": InstanceStatesChangerType;
        // Requests plugin permissions from user
        "requestPermissions"  : (
          permissions: Array<PermissionType>,
          extension: string
        ) => Promise<Array<boolean>>;
        // Syncs the config file using global states
        "syncConfig"          : () => Promise<void>;
        // Platform-specific delimiter obtained by a single invoke of Tauri 'join'
        "joinDelimiter"       : string;
        // Launcher version
        "launcherVersion"     : string;
        // Config state before launcher initialization
        "initialConfig"       : ConfigType;
        // Accounts state before launcher initialization
        "temporaryAccounts"   : Array<AccountType>;
        // Translations state before launcher initialization
        "initialTranslations" : TranslationsType;
        // Instances metadata state before launcher initialization
        "initialInstances"    : InstanceStatesType;
        // Portable state before launcher initialization
        "initialPortable"     : boolean;
        // Base directory state before launcher initialization
        "initialBaseDirectory": string;
        // A temporary storage for the 'At a Glance' widget
        "atAGlance"          ?: AtAGlanceType;
        // A timestamp for the application's JavaScript code initialization
        "startTime"          ?: number;
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
         * Launcher's development mode related collection of utilities
         */
        "DevelopmentModeHelpers": typeof DevelopmentModeHelpers;

        /**
         * Launcher's file structure
         */
        "FileStructure": typeof FileStructure;

        /**
         * Launcher's errors-related collection of utilities
         */
        "Errors": typeof Errors;

        /**
         * Launcher's extension system related collection of utilities
         */
        "ExtensionsManager": typeof ExtensionsManager;

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
         * Launcher's Minecraft instances related collection of utilities
         */
        "Instances": typeof Instances;

        /**
         * Launcher's Minecraft-related collection of utilities
         */
        "Launcher": typeof Launcher;

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
         * Executed on 'PageTeleports' mount
         */
        "pageTeleportsMount": {

          /**
           * Executes 'async' or 'sync' functions after the component was mounted.
           *
           * No arguments.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<"nothing", "nothing">;
        };

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
         * Executed on the 'extensions' field replacement in global states
         */
        "onExtensionsChange": {

          /**
           * Executes 'sync'-only functions before the 'extensions' property
           * in the global states will change.
           *
           * 'GlobalStatesType["extensions"]' typed object is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return a 'GlobalStatesType["extensions"]' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            GlobalStatesType["extensions"],
            GlobalStatesType["extensions"],
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the 'extensions' property in the global states has changed.
           *
           * 'GlobalStatesType["extensions"]' typed object is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<GlobalStatesType["extensions"], "nothing">;
        };

        /**
         * Executed on the field addition/overwrite/deletion in instance states
         */
        "onInstanceChange": {

          /**
           * Executes 'sync'-only functions before the provided field
           * in the instance states will change.
           *
           * '{ key: string, value: InstanceStateType }' typed object
           * is passed as the argument.
           *
           * If the hook returns a 'stop' status,
           * it should also return
           * a '{ key: string, value: InstanceStateType }' typed object
           * in the 'response' field.
           *
           * If the hook returns a 'continue' status,
           * code execution will continue as if that hook did not exist.
           */
          "before": HookReturnType<
            { "key": string; "value": InstanceStateType },
            { "key": string; "value": InstanceStateType },
            "non-promise"
          >;

          /**
           * Executes 'async' or 'sync' functions on the next Vue tick,
           * after the provided field in the instance states has changed.
           *
           * '{ key: string, value: InstanceStateType }' typed object
           * is passed as the argument.
           *
           * Hook should not return anything since the response will not be read.
           */
          "after": HookReturnType<
            { "key": string; "value": InstanceStateType },
            "nothing"
          >;
        };
      };
    };
  }
}

/* Export the Kaede namespace type */
export type KaedeNamespaceType = Window["__KAEDE__"];
