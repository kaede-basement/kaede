import { defineConfig, presetIcons, presetWind3 } from "unocss";

export default defineConfig({
  "theme": {
    "breakpoints": {
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
     * 'presetWind4' requires Chrome 111+ (March 9, 2023)
     * Otherwise colors won't work, so not worth it
     */
    presetWind3({
      // Apply dark theme only if there is a 'dark' class on parent elements
      "dark": "class",
    }),
    // Lucide icons that are available by class names (@iconify-json/lucide)
    presetIcons(),
  ],
});