<script setup lang="ts">
import { defineAsyncComponent, nextTick, provide, shallowReactive } from "vue";

import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import Layout from "@/components/layout/Layout.vue";
import Router from "@/components/layout/Router.vue";
import NonBundledClasses from "@/components/misc/NonBundledClasses.vue";
import ExtensionsError from "@/components/statuses/ExtensionsError.vue";
import GlobalError from "@/components/statuses/GlobalError.vue";
import {
  ApplicationNamespace,
  ContextMenuItems,
  GlobalStatesChangerContextKey,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import { HookMappings } from "@/constants/mappings.ts";
import { RouteItems } from "@/constants/routes.ts";
import { log } from "@/lib/handlers/log.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);
const ExtensionLoader = defineAsyncComponent(
  () => import("@/components/extensions/ExtensionLoader.vue"),
);

const globalStates = shallowReactive<GlobalStatesType>({
  "customLayout": false,
  "page"        : "home",
  "pageStates"  : {
    "home"    : {},
    "library" : {},
    "settings": { "tab": "extensions" },
    "none"    : {},
  },
  "showLogs"    : false,
  "sidebarItems": RouteItems.map(item => {
    return {
      "path"  : item.Path,
      "icon"  : item.Icon,
      "name"  : capitalize(item.Path),
      "action": (): void => changeGlobalState("page", item.Path),
    };
  }),
  "contextMenuItems": [...ContextMenuItems],
});

function getGlobalStates(): ContextGlobalStatesType {
  return globalStates;
}
function changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  const mappedKey = HookMappings[key];

  // Global states have not changed yet
  log.debug(`Starting iterating through hooks for '${mappedKey}.before'`);
  for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].before) {
    const hook = storedFunction as (anything: unknown) => unknown;
    const { status, response } = hook(value) as {
      "status"  : ExtensionStatusType;
      "response": GlobalStatesType[Key] | undefined;
    };

    if (status === "stop") {
      if (response !== undefined) {
        globalStates[key] = response;
      }

      return;
    }
  }

  log.debug(`Changing global state. Key: ${key}; value: ${value}`);
  globalStates[key] = value;

  nextTick().then(async () => {
    // Global states have changed now
    log.debug(`Starting iterating through hooks for '${mappedKey}.after'`);
    for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].after) {
      const hook = storedFunction as (anything: unknown) => Promise<unknown>;

      await hook(value);
    }
  });
}

provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);
provide<GlobalStatesChangerType>(GlobalStatesChangerContextKey, changeGlobalState);

window[ApplicationNamespace].functions.getGlobalStates = getGlobalStates;
window[ApplicationNamespace].functions.changeGlobalStates = changeGlobalState;
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout v-if="!globalStates.customLayout" :page="globalStates.page">
        <Router
          v-if="globalStates.page !== 'none'"
          :page="globalStates.page"
        />

        <Transition name="pop">
          <LogViewer v-if="globalStates.showLogs" />
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
