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
import type { ConfigType } from "@/types/configs/config.type.ts";

// Measure high resolution timestamp before launcher initialization
const startTime = performance.now();

// 'window[ApplicationNamespace]' is accessed not only by extensions, but by the application itself
Globals.declareWindow();

// Concurrent promise resolving saves us around 15 ms
const [launchCount, portable]: [number, boolean, void] = await Promise.all([
  // Get application UI reloads count
  Globals.getLaunchCount(),
  // Check if launcher is in a portable mode to share the status between multiple functions
  General.checkIsPortable(),

  /*
   * 'join' invokes from Tauri API are expensive (around 5 ms on my laptop);
   * Instead, run it once, find out the delimiter and use only the cached version after that.
   *
   * Does not return anything
   */
  Globals.handlePathJoin(),
]);

// Show a pretty ASCII art with the launcher name :3
log.info(getASCIIArt(portable, launchCount));

// Get the launcher's base directory to share the directory between multiple functions
const baseDirectory: string = await General.getBaseDirectory(portable);

const [config, instances]: [ConfigType, InstanceStatesType] = await Promise.all([
  // Get user's launcher configuration
  Configs.getSafe(baseDirectory),
  // Get user's launcher configuration
  Instances.readStored(baseDirectory),
]);

/*
 * Define launcher's initial values at globals to make them accessible from 'App.vue':
 *
 * - 'portable';
 * - 'baseDirectory';
 * - 'config';
 * - 'instances'.
 *
 * This way we can save at least 30 ms of time
 */
window[ApplicationNamespace].__internals.initialConfig = config;
window[ApplicationNamespace].__internals.initialInstances = instances;
window[ApplicationNamespace].__internals.initialPortable = portable;
window[ApplicationNamespace].__internals.initialBaseDirectory = baseDirectory;

// Enabling debug mode means that debug-level messages will be logged
if (config.development?.enableDebugMode) {
  DevelopmentModeHelpers.enableDebugMode(
    DevelopmentModeHelpers.getDefault(),
  );
}

// Log user's launcher configuration
log.debug(
  "Config contents:",
  "\n" + JSON.stringify(config, null, 2),
);
// Log user's instances metadata
log.debug(
  "Instances metadata contents:",
  "\n" + JSON.stringify(instances, null, 2),
);

// Create a Vue instance with the 'App.vue' entry
const AppInstance = createApp(App);

log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
// Attach the app to a DOM element with the '#app' id
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await General.initializeLauncher({ config, baseDirectory, startTime }).catch((error: unknown) => {
  log.error("Failed to initialize launcher:", Errors.prettify(error));
});
