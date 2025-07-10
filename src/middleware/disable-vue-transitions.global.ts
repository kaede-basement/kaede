export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || !document.startViewTransition) {
    return;
  }

  // Disable built-in Vue transitions
  to.meta.pageTransition = false;
  to.meta.layoutTransition = false;
});
