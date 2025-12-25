// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind-like way
import "@unocss/reset/tailwind.css";
// Import custom CSS styles
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";

import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationNamespace, ApplicationRootID } from "@/constants/application";
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

// Measure high resolution timestamp before launcher initialization
const startTime = performance.now();

// 'window[ApplicationNamespace]' is accessed not only by extensions but by the application itself
Globals.declareWindow();

// Concurrent promise resolving saves us around 15 ms
const [launchCount, portable]: [number, boolean, void, void] = await Promise.all([
  // Get application UI reloads count
  Globals.getLaunchCount(),
  // Check if launcher is in a portable mode to share the status between multiple functions
  General.checkIsPortable(),

  /*
   * Even the simplest invokes from Tauri API are expensive (around 5 ms on my laptop);
   * To optimize 'join' calls, find out the delimiter and cache it.
   *
   * Does not return anything
   */
  Globals.cachePathJoin(),
  // Cache the launcher version
  Globals.cacheLauncherVersion(),
]);

// Show a pretty ASCII art with the launcher name :3
log.info(
  getASCIIArt(portable, launchCount),
);

// Get the launcher base directory to share it between multiple functions
const baseDirectory: string = await General.getBaseDirectory(portable);

// Concurrent promise resolving saves us around 60 ms
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
  Configs.getTranslations(baseDirectory),
  Instances.readStored(baseDirectory),
]);

// Define launcher's initial values at globals to make them accessible from anywhere
window[ApplicationNamespace].__internals.initialConfig = config;
window[ApplicationNamespace].__internals.initialTranslations = translations;
window[ApplicationNamespace].__internals.initialInstances = instances;
window[ApplicationNamespace].__internals.initialPortable = portable;
window[ApplicationNamespace].__internals.initialBaseDirectory = baseDirectory;

/*
 * Exposing account details to the global object
 * makes retrieving account tokens in extensions a bit easier,
 * so we will delete this field as soon as the app-scoped reactive state will be created
 */
window[ApplicationNamespace].__internals.temporaryAccounts = accounts;

// Enabling debug mode means that debug-level messages will be logged
if (config.development?.enableDebugMode) {
  DevelopmentModeHelpers.enableDebugMode(
    config.development,
  );

  log.debug(log.templates.json.contents(
    "Config",
    config,
  ));
  log.debug(log.templates.json.contents(
    "Instances metadata",
    instances,
  ));
}

log.debug("Creating a Vue instance");
// 'App' is the 'App.vue' entry
const AppInstance = createApp(App);

log.debug(`Mounting an app instance to the DOM element (${ApplicationRootID})`);
// Attach the app to a DOM element with the '#app' id
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await General
  .initializeLauncher({ config, baseDirectory, startTime })
  .catch((error: unknown) => {
    log.error("Failed to initialize launcher:", Errors.prettify(error));
  });
