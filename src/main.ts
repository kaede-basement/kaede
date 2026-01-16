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

// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind-like way
import "@unocss/reset/tailwind.css";
// Import custom CSS styles
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";

import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationNamespace, ApplicationRootID, DefaultLocale } from "@/constants/application";
import { getASCIIArt } from "@/constants/ascii-art.ts";
import Configs from "@/lib/configs";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

const startTime = performance.now();

// 'window[ApplicationNamespace]' is accessed not only by extensions but by the application itself
Globals.declareWindow();

// Concurrent promise resolving saves us around 20 ms
const [launchCount, portable]: [number, boolean, void, void] = await Promise.all([
  // Get application UI reloads count
  Globals.getLaunchCount(),
  General.checkIsPortable(),

  /*
   * Even the simplest invokes from Tauri API are expensive (around 5 ms on my laptop).
   * To optimize 'join' calls, find out the delimiter and cache it
   */
  Globals.cachePathJoin(),
  Globals.cacheLauncherVersion(),
]);

// Show a pretty ASCII art with the launcher name :3
log.info(
  __PRE_BUNDLED_FILENAME__,
  getASCIIArt(portable, launchCount),
);

// Get the launcher base directory to share it between multiple functions
const baseDirectory: string = await General.getBaseDirectory(portable);

log.debug(__PRE_BUNDLED_FILENAME__, "Resolving config file, accounts, and instances");
const [
  config,
  accounts,
  translations,
  instances,
]: [
  ConfigType,
  Array<AccountType>,
  TranslationsType,
  InstanceStatesType,
] = await Promise.all([
  Configs.getSafe(baseDirectory),
  Configs.getAccounts(baseDirectory),
  Configs.getTranslations(baseDirectory, DefaultLocale, true),
  Instances.readStored(baseDirectory),
]);

log.debug(__PRE_BUNDLED_FILENAME__, "Caching internals");
const __internals = window[ApplicationNamespace].__internals;

// Define launcher's initial values at globals to make them accessible from anywhere
__internals.initialConfig = config;
__internals.initialTranslations = translations;
__internals.initialInstances = instances;
__internals.initialPortable = portable;
__internals.initialBaseDirectory = baseDirectory;

/*
 * Exposing account details to the global object
 * makes retrieving account tokens in extensions a bit easier,
 * so we will delete this field as soon as the app-scoped reactive state will be created
 */
__internals.temporaryAccounts = accounts;

// Enabling debug mode means that debug-level messages will be logged
if (config.development?.enableDebugMode) {
  DevelopmentModeHelpers.enableDebugMode(
    config.development,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    "Config",
    config,
  ));
  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    "Instances metadata",
    instances,
  ));
}

log.debug(__PRE_BUNDLED_FILENAME__, "Creating a Vue instance");
const AppInstance = createApp(App);

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing Vue Query plugin");
AppInstance.use(VueQueryPlugin);

log.debug(
  __PRE_BUNDLED_FILENAME__,
  `Mounting an app instance to the DOM element (${ApplicationRootID})`,
);
AppInstance.mount(ApplicationRootID);

log.debug(__PRE_BUNDLED_FILENAME__, "Initializing launcher");
await General
  .initializeLauncher({ config, baseDirectory, startTime })
  .catch((error: unknown) => {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to initialize launcher:", Errors.prettify(error));
  });
