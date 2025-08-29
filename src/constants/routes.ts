import { createRoute } from "@kitbag/router";
import { defineAsyncComponent } from "vue";

export const Routes = {
  "Home": {
    "Key" : "Home",
    "Path": "/",
  },
  "About": {
    "Key" : "About",
    "Path": "/about",
  },
} as const;
export const RoutesConfiguration = Object
  .values(Routes)
  .map(({ Key, Path }) => createRoute({
    "name"     : Key,
    "path"     : Path,
    "component": defineAsyncComponent(() => import(`@/pages/${Key}.vue`)),
  }));