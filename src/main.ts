// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
// Import custom CSS styles
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";

import { createApp } from "vue";

import App from "@/App.vue";
import { ApplicationRootID } from "@/constants/application";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import Globals from "@/lib/globals";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";

// No need to log yet, all logs will go into the previous launch log file
await Logging.prepareLogFile().catch((error: unknown) => {
  log.error("Failed to prepare a log file:", Errors.prettify(error));
});

// Now the log file preparation is done (unless something threw an error)
log.debug("Extending global window object in the app namespace");
Globals.declareWindow();

log.debug("Creating an app instance");
const AppInstance = createApp(App);

// Attach the app to an element with the 'ApplicationRootID' id
log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await General.initializeLauncher().catch((error: unknown) => {
  log.error("Failed to initialize launcher:", Errors.prettify(error));
});
