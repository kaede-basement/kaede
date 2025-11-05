import { ApplicationRootID } from "@/constants/application";
import { createApp } from "vue";
import { initializeLauncher } from "@/lib/main/initialize-launcher.ts";
import { declareWindow } from "@/lib/main/declare-window.ts";
import { log } from "@/lib/handlers/log.ts";
import { prepareLogFile } from "@/lib/main/prepare-log-file.ts";
import App from "@/App.vue";
// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
import "@/globals.css";
// Import styles that are necessary for Material You ripple effect
import "m3ripple-vue/style.css";
// import "core-js/actual";
// asdf.

await prepareLogFile().catch((error: unknown) => {
  log.error("Failed to prepare a log file:", JSON.stringify(error));
});

log.debug("Extending global window object in the app namespace");
declareWindow();

log.debug("Creating an app instance");
const AppInstance = createApp(App);

// Attach the app to an element with the 'ApplicationRootID' id
log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await initializeLauncher().catch((error: unknown) => {
  log.error("Failed to initialize launcher:", JSON.stringify(error));
});
