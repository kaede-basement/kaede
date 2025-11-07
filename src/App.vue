<script setup lang="ts">
import { defineAsyncComponent, onMounted, provide, shallowReactive } from "vue";

import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import Layout from "@/components/layout/Layout.vue";
import Router from "@/components/layout/Router.vue";
import NonBundledClasses from "@/components/misc/NonBundledClasses.vue";
import ExtensionsError from "@/components/statuses/ExtensionsError.vue";
import GlobalError from "@/components/statuses/GlobalError.vue";
import {
  ApplicationNamespace,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import { changeGlobalState } from "@/lib/helpers/change-global-state.ts";
import { getConfigGlobalStates } from "@/lib/main/get-config-global-states.ts";
import { getDefaultGlobalStates } from "@/lib/main/get-default-global-states.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

/* These components will load only when needed */
const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);
const ExtensionLoader = defineAsyncComponent(
  () => import("@/components/extensions/ExtensionLoader.vue"),
);

const globalStates = shallowReactive<GlobalStatesType>(getDefaultGlobalStates());

function getGlobalStates(): ContextGlobalStatesType {
  return globalStates;
}
function setGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  globalStates[key] = value;
}
function scopedChangeGlobalStates<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  changeGlobalState(key, value, setGlobalState);
}

provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);

window[ApplicationNamespace].functions.getGlobalStates = getGlobalStates;
window[ApplicationNamespace].functions.changeGlobalStates = scopedChangeGlobalStates;

onMounted(async () => {
  const userConfig = await getConfigGlobalStates();

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
