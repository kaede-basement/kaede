/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
import type { KaedeNamespaceType } from "@/declarations.ts";
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

function placeholderFunction(): void {}

/**
 * An object that contains everything that can be changed by extensions.
 *
 * The launcher heavily relies on this object in all kind of code places
 */
export const GlobalObject: KaedeNamespaceType = {
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
    "onConfigFileGet"              : { "before": [], "after": [] },
    "onDefaultConfigGet"           : { "before": [] },
    "onPagesChange"                : { "before": [], "after": [] },
    "onLayoutChange"               : { "before": [], "after": [] },
    "onLogsChange"                 : { "before": [], "after": [] },
    "onSidebarItemsChange"         : { "before": [], "after": [] },
    "onContextMenuItemsChange"     : { "before": [], "after": [] },
    "onDevelopmentChange"          : { "before": [], "after": [] },
    "onMiscChange"                 : { "before": [], "after": [] },
    "onMinecraftChange"            : { "before": [], "after": [] },
    "onTranslationsChange"         : { "before": [], "after": [] },
    "onExtensionsChange"           : { "before": [], "after": [] },
    "onInstanceChange"             : { "before": [], "after": [] },
    "onPreLaunchInformation"       : { "before": [], "after": [] },
    "onVersionMeta"                : { "before": [], "after": [] },
    "onLibrariesParsing"           : { "before": [], "after": [] },
    "onMinecraftAssetsGet"         : { "before": [], "after": [] },
    "onMinecraftPatchesGet"        : { "before": [], "after": [] },
    "onMinecraftClientGet"         : { "before": [], "after": [] },
    "onMinecraftLoggingGet"        : { "before": [], "after": [] },
    "onMinecraftLibrariesGet"      : { "before": [], "after": [] },
    "onNativesExtract"             : { "before": [], "after": [] },
    "onJavaBinaryGet"              : { "before": [] },
    "onJVMArgumentsGet"            : { "before": [], "after": [] },
    "onClassPathsGet"              : { "before": [] },
    "onGameArgumentsGet"           : { "before": [], "after": [] },
    "onAdditionalStartArgumentsGet": { "before": [] },
    "onLaunchArgumentsReplace"     : { "before": [], "after": [] },
    "onMinecraftLaunch"            : { "before": [], "after": [] },
    "onMinecraftKill"              : { "before": [], "after": [] },
    "onMinecraftPatchResolve"      : { "before": [], "after": [] },
  },
};