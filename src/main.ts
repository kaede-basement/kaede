// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind-like way
import "@unocss/reset/tailwind.css";
// Import custom CSS styles
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationNamespace, ApplicationRootID } from "@/constants/application";
import { getASCIIArt } from "@/constants/ascii-art.ts";
import Configs from "@/lib/configs";
import { DevelopmentModeHelpers } from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

// Measure high resolution timestamp before launcher initialization
const startTime = performance.now();

// Check if launcher is in a portable mode to share the status between multiple functions
const portable: boolean = await General.checkIsPortable();
// Get the launcher's base directory to share the directory between multiple functions
const baseDirectory: string = await General.getBaseDirectory(portable);

// No need to log yet since all logs will go into the previous launch log file
await Logging.prepareLogFile(baseDirectory).catch((error: unknown) => {
  log.error("Failed to prepare a log file:", Errors.prettify(error));
});

/*
 * Now the log file preparation is done (unless something threw an error).
 *
 * Show a pretty ASCII art with the launcher name :3
 */
log.info(getASCIIArt(portable));

/*
 * Previous code doesn't access the 'window[ApplicationNamespace]' object,
 * but config reading does. That's why we extend the globals only now
 */
Globals.declareWindow();
log.info("Extended the global window object with the app namespace");

// Get user's launcher configuration
const config: ConfigType = await Configs.getSafe(baseDirectory);

// Define launcher's initial config at globals to make it accessible from 'App.vue'
window[ApplicationNamespace].__internals.initialConfig = config;

// Enabling debug mode means that debug-level messages will be logged
if (config.development.enableDebugMode) {
  DevelopmentModeHelpers.enableDebugMode();
}

/*
 * Launcher's window is not visible by default
 * to prevent white screen flashing while webview has not loaded
 */
if (config.showBeforeInitialization) {
  try {
    log.debug("Showing webview window before initialization according to user's config");
    await getCurrentWebviewWindow().show();
  } catch (error: unknown) {
    log.error("Failed to show the webview window before initialization:", Errors.prettify(error));
  }
}

// Log user's launcher configuration
log.debug(
  "Config contents:",
  "\n" + JSON.stringify(config, null, 2),
);

// Create a Vue instance with the 'App.vue' entry
const AppInstance = createApp(App);

log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
// Attach the app to a DOM element with the '#app' id
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await General.initializeLauncher(config, startTime).catch((error: unknown) => {
  log.error("Failed to initialize launcher:", Errors.prettify(error));
});
