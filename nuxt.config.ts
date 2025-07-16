export default defineNuxtConfig({
  // Leave it as it is
  "compatibilityDate": "2025-05-15",

  /*
   * Enable View Transition API to animate page navigation
   * we will disable it in the middleware if user disabled transitions in the config
   */
  "experimental": {
    "viewTransition": true,
  },
  "app": {

    /*
     * Enable old page transitions. We will disable it in the middleware,
     * if user's webview already supports View Transition API
     * we will also disable it in the middleware if user disabled transitions in the config
     */
    "pageTransition": {
      // Use "fade" as a transition name to use styles from ~/src/layouts/root.vue
      "name" : "fade",
      // New pages should appear only after the current page's animation has ended
      "mode" : "out-in",
    },
  },
  // Nuxt source code directory
  "srcDir"   : "./src",
  "devtools" : {
    "enabled": true,
  },
  // Desktop apps are fully CSR, so we disable Server-Side Rendering
  "ssr"  : false,
  // Vite configuration
  "vite" : {
    // Better support for Tauri CLI output
    "clearScreen": false,

    /*
     * Enable environment variables
     * Additional environment variables can be found at
     * https://v2.tauri.app/reference/environment-variables/
     */
    "envPrefix" : ["VITE_", "TAURI_"],
    "server"    : {
      // Tauri requires a consistent port
      "strictPort": true,
    },
  },

  /*
   * Nuxt modules
   * Additional modules can be found at
   * https://nuxt.com/modules
   */
  "modules": [
    "@nuxt/eslint",
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/test-utils",
    "@unocss/nuxt",
    // Configures Tanstack Query for Nuxt
    "@hebilicious/vue-query-nuxt",
    "@pinia/nuxt",
  ],
  "fonts": {
    // What font weights, styles and subsets to load for each font
    "defaults": {
      "weights" : [400],
      "styles"  : ["normal", "italic"],
      "subsets" : [
        "cyrillic-ext",
        "cyrillic",
        "greek-ext",
        "greek",
        "vietnamese",
        "latin-ext",
        "latin",
      ],
    },

    /*
     * Load Geist font
     * https://vercel.com/font
     */
    "families": [
      {
        "name"     : "Geist",
        "provider" : "google",
      },
    ],
  },
  // Avoid error [unhandledRejection] EMFILE: too many open files, watch
  "ignore": ["**/src-tauri/**"],
});
