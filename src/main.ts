import { RoutesConfiguration } from "@/constants/routes";
import { ApplicationRootID } from "@/constants/application";
import { createApp } from "vue";
import { createRouter } from "@kitbag/router";
import { initializeLauncher } from "@/lib/main/initialize-launcher.ts";
import App from "@/App.vue";
// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
import "@/globals.css";

const RouterInstance = createRouter(RoutesConfiguration);
const AppInstance = createApp(App);

AppInstance.use(RouterInstance);
// Attach the app to an element with the 'ApplicationRootID' id
AppInstance.mount(ApplicationRootID);

await initializeLauncher().catch((error: unknown) => {
  console.error("Failed to initialize launcher:", error);
});
