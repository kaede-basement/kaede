// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  experimental: {
    viewTransition: true,
  },
  srcDir:            "./src",
  compatibilityDate: "2025-05-15",
  devtools:          { enabled: true },
  // Desktop apps are fully CSR
  ssr:               false,
  vite:              {
    // Better support for Tauri CLI output
    clearScreen: false,
    // Enable environment variables
    // Additional environment variables can be found at
    // https://v2.tauri.app/reference/environment-variables/
    envPrefix:   ["VITE_", "TAURI_"],
    server:      {
      // Tauri requires a consistent port
      strictPort: true,
    },
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/fonts",
    "@nuxt/icon",
    "@nuxt/image",
    "@nuxt/test-utils",
    "@unocss/nuxt",
  ],
  fonts: {
    defaults: {
      weights: [400],
      styles:  ["normal", "italic"],
      subsets: [
        "cyrillic-ext",
        "cyrillic",
        "greek-ext",
        "greek",
        "vietnamese",
        "latin-ext",
        "latin",
      ],
    },
    families: [
      {
        name:     "Geist",
        provider: "google",
      },
    ],
  },
  // Avoids error [unhandledRejection] EMFILE: too many open files, watch
  ignore: ["**/src-tauri/**"],
});
