<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ExtensionLoader from "@/components/extensions/ExtensionLoader.vue";
import { provide, shallowReactive, nextTick, defineAsyncComponent } from "vue";
import Router from "@/components/layout/Router.vue";
import {
  ApplicationNamespace, ContextMenuItems,
  GlobalStatesChangerContextKey,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import { HookMappings } from "@/constants/mappings.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";
import GlobalError from "@/components/statuses/GlobalError.vue";
import ExtensionsError from "@/components/statuses/ExtensionsError.vue";
import NonBundledClasses from "@/components/misc/NonBundledClasses.vue";
import { RouteItems } from "@/constants/routes.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";
import { log } from "@/lib/handlers/log.ts";
import { Command } from "@tauri-apps/plugin-shell";

const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);

(async () => {
  const result = await Command.create("java", [
    "--version",
  ]).execute();

  console.log(result);
})();

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

function changeGlobalState<Key extends keyof GlobalStatesType>(key: Key, value: GlobalStatesType[Key]): void {
  log.debug(`Changing global state; key: ${key}; value: ${value}`);
  const mappedKey = HookMappings[key];

  // Global states have not changed yet
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

  globalStates[key] = value;

  nextTick().then(async () => {
    // Global states have changed now
    for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].after) {
      const hook = storedFunction as (anything: unknown) => Promise<unknown>;

      await hook(value);
    }
  });
}

provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);
provide<GlobalStatesChangerType>(GlobalStatesChangerContextKey, changeGlobalState);

window[ApplicationNamespace].functions.getGlobalStates = () => globalStates;
window[ApplicationNamespace].functions.changeGlobalStates = changeGlobalState;
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout v-if="!globalStates.customLayout">
        <Router
          v-if="globalStates.page !== 'none'"
          :page="globalStates.page"
        />
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
      <ExtensionLoader />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>

  <Transition name="pop">
    <LogViewer v-if="globalStates.showLogs" />
  </Transition>

  <NonBundledClasses />
</template>
