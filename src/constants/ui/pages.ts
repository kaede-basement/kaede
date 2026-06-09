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

import { defineAsyncComponent } from "vue";

/**
 * App-level lazy-loaded components
 */
export const LazyLogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);
export const LazyExtensionLoader = defineAsyncComponent(
  () => import("@/components/general/extensions/ExtensionLoader.vue"),
);
export const LazyDevelopmentMode = defineAsyncComponent(
  () => import("@/components/general/development-mode/DevelopmentMode.vue"),
);

/**
 * Page-specific lazy-loaded components
 */
export const LazyHome = defineAsyncComponent(
  () => import("@/components/home/Home.vue"),
);
export const LazyLibrary = defineAsyncComponent(
  () => import("@/components/library/Library.vue"),
);
export const LazySettings = defineAsyncComponent(
  () => import("@/components/settings/Settings.vue"),
);
export const LazyAddInstance = defineAsyncComponent(
  () => import("@/components/add-instance/AddInstance.vue"),
);
export const LazyProfile = defineAsyncComponent(
  () => import("@/components/profile/Profile.vue"),
);
