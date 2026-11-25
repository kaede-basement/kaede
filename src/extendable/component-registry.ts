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

import { type Component, defineAsyncComponent, shallowReactive } from "vue";

import { installQuery } from "@/bootstrap/query.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/log.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

type ComponentRegistryType = {
  [key: string]     : Component;
  "ContextMenu"     : Component;
  "GlobalBackground": Component;
  "LaunchProgress"  : Component;
  "Layout"          : Component;
  "PagesSelector"   : Component;
  "PageWrapper"     : Component;
  "Router"          : Component;
  "Sidebar"         : Component;
  "Tabs"            : Component;
  "AddInstance"     : Component;
  "Home"            : Component;
  "Library"         : Component;
  "Profile"         : Component;
  "Settings"        : Component;
};

export const LazyExtensionLoader = defineAsyncComponent(async () => {
  await installQuery();

  return import("@/components/general/extensions/ExtensionLoader.vue");
});
export const LazyPluginPlayground = defineAsyncComponent(() => (
  import("@/components/settings/tabs/PluginPlayground.vue")
));

/*
 * Extensions can use this registry to replace existing components with their own ones.
 */
let originals: ComponentRegistryType;

export const C: ComponentRegistryType = shallowReactive({} as ComponentRegistryType);

export function initializeComponents(builtins: ComponentRegistryType): void {
  if (originals) return;
  originals = builtins;
  Object.assign(C, builtins);
}

export function __registerComponent(name: string, component: Component): void {
  if (name in C) {
    log.warn(__PRE_BUNDLED_FILENAME__, `Overriding application-side '${name}' component`);
    C[name] = component;

    return;
  }

  GlobalInternals.appInstance?.component?.(name, component);
}

export function __restoreComponent(name: string): boolean {
  if (IsKeyInObject(name, C) && IsKeyInObject(name, originals)) {
    log.debug(__PRE_BUNDLED_FILENAME__, `Restoring a component '${name}'...`);
    C[name] = originals[name];

    log.info(__PRE_BUNDLED_FILENAME__, `The component '${name}' was restored`);

    return true;
  }

  return false;
}
