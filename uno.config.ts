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
  "safelist": [
    "i-lucide-shield-check",
    "i-lucide-folder-key",
    "i-lucide-package-open",
    "i-lucide-package-search",
    "i-lucide-view",
    "i-lucide-eye",
    "i-lucide-globe",
    "i-lucide-hat-glasses",
    "i-lucide-hourglass",
    "i-lucide-timer",
    "i-lucide-circle-alert",
    "i-lucide-app-window",
    "i-lucide-panel-top",
    "i-lucide-file-cog",
    "i-lucide-trash-2",
    "i-lucide-copy",
    "i-lucide-file-search",
    "i-lucide-star",
    "i-lucide-tool-case",
    "i-lucide-gauge",
    "i-lucide-refresh-cw",
    "i-lucide-mouse-pointer-click",
    "i-lucide-construction",
    "i-lucide-door-open",
    "i-lucide-triangle-alert",
    "i-lucide-brick-wall",
    "i-lucide-file-question-mark",
    "i-lucide-gamepad-2",
    "i-lucide-braces",
    "i-lucide-box",
    "i-lucide-plus",
    "i-lucide-home",
    "i-lucide-boxes",
    "i-lucide-settings",
    "i-lucide-rotate-ccw",
    "i-lucide-bug",
    "i-lucide-folder",
    "i-lucide-sliders-horizontal",
    "i-lucide-square-terminal",
    "i-lucide-blocks",
    "i-lucide-languages",
    "i-lucide-paintbrush-vertical",
    "i-lucide-coffee",
    "i-lucide-clock",
    "i-lucide-cpu",
    "i-lucide-memory-stick",
    "i-lucide-unfold-vertical",
    "i-lucide-droplet",
    "i-lucide-sparkles",
    "i-lucide-image",
    "i-lucide-square-dashed",
    "i-lucide-palette",
    "i-lucide-film",
    "i-lucide-type",
    "i-lucide-baseline",
    "i-lucide-square",
    "i-lucide-move-horizontal",
    "i-lucide-move-vertical",
    "i-lucide-minus",
    "i-lucide-folder-open",
    "i-lucide-pipette",
    "text-blue-300",
    "text-fuchsia-300",
    "text-lime-300",
    "text-neutral-400",
    "text-neutral-500",
    "text-orange-300",
    "text-rose-500",
    "text-sky-300",
    "text-teal-200",
  ],
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
