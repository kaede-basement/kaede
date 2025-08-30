import { RoutesConfiguration } from "@/constants/routes";
import { ApplicationRootID } from "@/constants/application";
import { createApp } from "vue";
import { createRouter } from "@kitbag/router";
import { initializeLauncher } from "@/lib/main/initialize-launcher.ts";
import { log } from "@/lib/handlers/log.ts";
import App from "@/App.vue";
// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
import "@/globals.css";

log.debug("Creating a router instance");
const RouterInstance = createRouter(RoutesConfiguration);

log.debug("Creating an app instance");
const AppInstance = createApp(App);

log.debug("Linking router instance with the app");
AppInstance.use(RouterInstance);

// Attach the app to an element with the 'ApplicationRootID' id
log.debug(`Mounting app instance to the DOM element (${ApplicationRootID})`);
AppInstance.mount(ApplicationRootID);

log.debug("Initializing launcher");
await initializeLauncher().catch((error: unknown) => {
  log.error("Failed to initialize launcher:", JSON.stringify(error));
});
