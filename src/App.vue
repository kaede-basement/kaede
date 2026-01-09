<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { defineAsyncComponent, provide, shallowReactive } from "vue";

import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import ExtensionsError from "@/components/general/errors/ExtensionsError.vue";
import GlobalError from "@/components/general/errors/GlobalError.vue";
import CssThemeLoader from "@/components/general/extensions/CssThemeLoader.vue";
import CustomLayout from "@/components/general/layout/CustomLayout.vue";
import Layout from "@/components/general/layout/Layout.vue";
import Router from "@/components/general/layout/Router.vue";
import ConfigSyncer from "@/components/general/misc/ConfigSyncer.vue";
import NonBundledClasses from "@/components/general/misc/NonBundledClasses.vue";
import {
  ApplicationNamespace,
  GlobalStatesContextKey,
  InstanceStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application.ts";
import DevelopmentModeHelpers from "@/lib/development-mode-helpers";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { __changeGlobalState } from "@/lib/global-state-helpers/scopes/change-global-state.ts";
import Instances from "@/lib/instances";
import { __changeInstanceState } from "@/lib/instances/scopes/change-instance-state.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  ContextInstanceStatesType,
  InstanceStatesType,
} from "@/types/application/instance-states.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

/**
 * These components will load only when needed.
 */
const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);
const ExtensionLoader = defineAsyncComponent(
  () => import("@/components/general/extensions/ExtensionLoader.vue"),
);
const DevelopmentMode = defineAsyncComponent(
  () => import("@/components/general/development-mode/DevelopmentMode.vue"),
);

/**
 * Contains all global application states.
 */
const globalStates = shallowReactive<GlobalStatesType>(GlobalStateHelpers.getFromConfig());

/**
 * Contains all Minecraft instance states.
 */
const instanceStates = shallowReactive<InstanceStatesType>(Instances.getFromConfig());

/**
 * Returns a reference to the proxied object of global states.
 */
function getGlobalStates(): GlobalStatesType {
  return globalStates;
}

/**
 * Returns a reference to the proxied object of instance states.
 */
function getInstanceStates(): InstanceStatesType {
  return instanceStates;
}

/**
 * Replaces a specified field in the global states with the provided value.
 */
function __setGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  globalStates[key] = value;
}

/**
 * Replaces a specified field in the instance states with the provided value.
 */
function __setInstanceState<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
): void {
  instanceStates[key] = value;
}

/**
 * Changes a specified field in the global states with the provided value
 * while handling all attached hooks.
 *
 * @param key   - the array of input numbers
 * @param value - the array of input numbers
 */
function scopedChangeGlobalStates<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  __changeGlobalState(key, value, __setGlobalState);
}

/**
 * Changes a specified field in the instance states with the provided value
 * while handling all attached hooks.
 */
function scopedChangeInstanceStates<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
): void {
  __changeInstanceState(key, value, __setInstanceState);
}

/**
 * Provides a reference to the instance-level reactive global states
 * for all component children.
 */
provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);

/**
 * Provides a reference to the instance-level reactive translations state
 * for all component children.
 */
provide<TranslationsType>(TranslationsContextKey, globalStates.translations);

/**
 * Provides a reference to the instance-level reactive Minecraft instance states
 * for all component children.
 */
provide<ContextInstanceStatesType>(InstanceStatesContextKey, instanceStates);

/**
 * Provides a reference to the function that returns a reference to the global states object.
 */
window[ApplicationNamespace].__internals.getGlobalStates = getGlobalStates;

/**
 * Provides a reference to the function that changes the value of a global states field.
 */
window[ApplicationNamespace].__internals.changeGlobalStates = scopedChangeGlobalStates;

/**
 * Provides a reference to the function that returns a reference to the instance states object.
 */
window[ApplicationNamespace].__internals.getInstanceStates = getInstanceStates;

/**
 * Provides a reference to the function that changes the value of an instance states field.
 */
window[ApplicationNamespace].__internals.changeInstanceStates = scopedChangeInstanceStates;

/**
 * Handles 'F5', 'Ctrl+R', and 'Command+R' key binds that reload the launcher
 */
useEventListener("keydown", (event: KeyboardEvent) => (
  DevelopmentModeHelpers.handleNativeReloadKeyBinds(
    event,
    globalStates.development?.enableNativeReloadKeyBinds,
  )
));
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout
        v-if="globalStates.layout.custom !== true"
        :page="globalStates.pages.current"
        :to-show-sidebar="
          !Array.isArray(globalStates.layout.custom) ||
          !globalStates.layout.custom.includes('sidebar')
        "
        :to-show-context-menu="
          !Array.isArray(globalStates.layout.custom) ||
          !globalStates.layout.custom.includes('contextMenu')
        "
      >
        <Router
          v-if="globalStates.pages.current !== 'none'"
          :page="globalStates.pages.current"
        />

        <Transition name="pop">
          <LogViewer v-if="globalStates.logs.show" />
        </Transition>

        <DevelopmentMode
          v-if="globalStates.development"
          :development="globalStates.development"
        />
        <NonBundledClasses />
      </Layout>
      <CustomLayout v-else />

      <ConfigSyncer />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <GlobalError :error="currentError" />
    </template>
  </ErrorBoundary>

  <!-- Extensions-level error boundary -->
  <ErrorBoundary>
    <template #default>
      <CssThemeLoader />
      <ExtensionLoader v-if="globalStates.extensions.enabled" />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>
</template>
