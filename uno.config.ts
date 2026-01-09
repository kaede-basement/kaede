/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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
