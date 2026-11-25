import { GlobalInternals } from "@/extendable/global-internals.ts";

let installedOn: typeof GlobalInternals.appInstance;

export async function installQuery(): Promise<void> {
  const { VueQueryPlugin } = await import("@tanstack/vue-query");
  const app = GlobalInternals.appInstance;

  if (!app) {
    throw new Error("Vue Query requires an application instance");
  }
  if (installedOn !== app) {
    app.use(VueQueryPlugin);
    installedOn = app;
  }
}
