// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
// Import custom CSS styles
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";

import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationRootID } from "@/constants/application";
import { getASCIIArt } from "@/constants/ascii-art.ts";
import Configs from "@/lib/configs";
import { DevelopmentModeHelpers } from "@/lib/development-mode-helpers";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

// Get the exact timestamp in milliseconds before initialization
const startTime = performance.now();

// Share the 'portable' status between other functions
const portable: boolean = await General.checkIsPortable();
// Get launcher base directory
const baseDirectory: string = await General.getBaseDirectory(portable);

// No need to log yet, all logs will go into the previous launch log file
await Logging.prepareLogFile(baseDirectory).catch((error: unknown) => {
  log.error("Failed to prepare a log file:", Errors.prettify(error));
});

log.debug("Extending global window object in the app namespace");
Globals.declareWindow();

// Get user's launcher configuration
const config: ConfigType = await Configs.getSafe(baseDirectory);

// Enabling debug mode means that debug-level messages will be logged
if (config.development.enableDebugMode) {
  DevelopmentModeHelpers.enableDebugMode();
}

/*
 * Now the log file preparation is done (unless something threw an error).
 *
 * Show a pretty ASCII art with the launcher name :3
 */
log.info(getASCIIArt(portable, config.development.enableDebugMode));

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

log.debug("Creating an app instance");
const AppInstance = createApp(App);

// Attach the app to an element with the 'ApplicationRootID' id
log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await General.initializeLauncher(config).catch((error: unknown) => {
  log.error("Failed to initialize launcher:", Errors.prettify(error));
});

// Get the exact timestamp in milliseconds after initialization
const endTime = performance.now();

log.info(
  "Launcher was initialized in",
  (endTime - startTime).toFixed(2),
  "ms",
);
