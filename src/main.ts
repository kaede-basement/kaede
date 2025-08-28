import { RoutesConfiguration } from "@/constants/routes";
import { ApplicationRootID } from "@/constants/application";
import { createApp } from "vue";
import { createRouter } from "@kitbag/router";
import App from "@/App.vue";
// Import UnoCSS essentials
import "virtual:uno.css";
// Reset all CSS styles in a Tailwind style
import "@unocss/reset/tailwind.css";
import "@/globals.css";

const Router = createRouter(RoutesConfiguration);
const AppInstance = createApp(App);

AppInstance.use(Router);
AppInstance.mount(ApplicationRootID);
