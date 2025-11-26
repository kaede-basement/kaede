import { defineConfig, presetIcons, presetWind3 } from "unocss";

export default defineConfig({
  "theme": {
    "breakpoints": {
      // All breakpoint sizes were taken from the Tailwind website
      "xs" : "480px",
      "sm" : "640px",
      "md" : "768px",
      "lg" : "1024px",
      "xl" : "1280px",
      "2xl": "1536px",
    },
  },
  "presets": [

    /*
     * 'presetWind4' requires Chrome 111+ (March 9, 2023).
     * Older WebView versions will not display colors.
     */
    presetWind3({
      // Apply dark theme only if there is a 'dark' class on parent elements
      "dark": "class",
    }),
    // Make Lucide icons available by class names (@iconify-json/lucide)
    presetIcons(),
  ],
});