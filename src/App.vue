<script setup lang="ts">
import { defineAsyncComponent, onBeforeMount, provide, shallowReactive } from "vue";

import ErrorBoundary from "@/components/general/errors/ErrorBoundary.vue";
import ExtensionsError from "@/components/general/errors/ExtensionsError.vue";
import GlobalError from "@/components/general/errors/GlobalError.vue";
import Layout from "@/components/general/layout/Layout.vue";
import Router from "@/components/general/layout/Router.vue";
import NonBundledClasses from "@/components/general/misc/NonBundledClasses.vue";
import {
  ApplicationNamespace,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { __changeGlobalState } from "@/lib/global-state-helpers/scopes/change-global-state.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

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
 * Initially takes default values, then the user config is applied.
 *
 * Gathering everything in one big 'shallowReactive' state
 * is considered to be a bad practice.
 *
 * But I believe that in extensible applications this is the best approach to:
 * - make extension hooks have a well-defined behaviour;
 * - not lose state values across application;
 * - simplify bidirectional state access between the application and extensions;
 */
const globalStates = shallowReactive<GlobalStatesType>(GlobalStateHelpers.getDefault());

/**
 * Returns a reference to the proxied object of global states.
 */
function getGlobalStates(): GlobalStatesType {
  return globalStates;
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
 * Changes a specified field in the global states with the provided value
 * while handling all attached hooks.
 */
function scopedChangeGlobalStates<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  __changeGlobalState(key, value, __setGlobalState);
}

/**
 * Provides a reference to the instance-reactive global states for all instance children.
 */
provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);

/**
 * Provides a reference to the function that returns a reference to the global states object.
 */
window[ApplicationNamespace].__internals.getGlobalStates = getGlobalStates;

/**
 * Provides a reference to the function that changes the value of a global states field.
 */
window[ApplicationNamespace].__internals.changeGlobalStates = scopedChangeGlobalStates;

/**
 * Applies user config values to the global states.
 */
onBeforeMount(async () => {
  // We can't use top-level await, so we apply config here
  log.debug("Getting global states from a config");
  const userConfig = await GlobalStateHelpers.getFromConfig(globalStates);

  log.debug("Applying global states from a config to the 'globalStates' reactive state");
  for (const [key, value] of Object.entries(userConfig)) {
    globalStates[key as "locale"] = value as GlobalStatesType["locale"];
  }
});
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout v-if="!globalStates.layout.custom" :page="globalStates.pages.current">
        <Router
          v-if="globalStates.pages.current !== 'none'"
          :page="globalStates.pages.current"
        />

        <Transition name="pop">
          <LogViewer v-if="globalStates.logs.show" />
        </Transition>

        <DevelopmentMode v-if="globalStates.development.enabled" />
        <NonBundledClasses />
      </Layout>
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <GlobalError :error="currentError" />
    </template>
  </ErrorBoundary>

  <!-- Extensions-level error boundary -->
  <ErrorBoundary>
    <template #default>
      <ExtensionLoader v-if="false" />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>
</template>
