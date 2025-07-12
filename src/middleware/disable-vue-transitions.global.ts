import getConfig from "~/lib/helpers/getConfig";

export default defineNuxtRouteMiddleware(async to => {
  // get current app config
  const currentConfig = await getConfig();

  // remove all transitions if user disabled them in the config
  if (!currentConfig.customization.pageTransitions) {
    to.meta.pageTransition = false;
    to.meta.layoutTransition = false;
    to.meta.viewTransition = false;

    return;
  }

  /*
   * return early and don't execute next lines of code
   * if user's webview doesn't support View Transition API
   * this will leave ancient page transitions still enabled
   */
  if (!document.startViewTransition) {
    return;
  }

  // disable built-in Vue transitions, because View Transition is supported
  to.meta.pageTransition = false;
  to.meta.layoutTransition = false;
});
