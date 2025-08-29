import { defineConfig, presetIcons, presetWind3 } from "unocss";

export default defineConfig({
  "presets": [

    /*
     * 'presetWind4' requires Chrome 111+ (March 9, 2023)
     * Otherwise colors won't work, so not worth it
     */
    presetWind3({
      // Apply dark theme only if there is a 'dark' class on parent elements
      "dark": "class",
    }),
    // Lucide icons available by class names (@iconify-json/lucide)
    presetIcons(),
  ],
});