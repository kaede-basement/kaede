<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ExtensionLoader from "@/components/extensions/ExtensionLoader.vue";
import { provide, shallowReactive, nextTick } from "vue";
import Router from "@/components/layout/Router.vue";
import {
  ApplicationNamespace,
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

const globalStates = shallowReactive<GlobalStatesType>({
  "customLayout": false,
  "page"        : "home",
  "pageStates"  : {
    "home"    : {},
    "library" : {},
    "settings": { "tab": "extensions" },
    "none"    : {},
  },
});

function changeGlobalState<Key extends keyof GlobalStatesType>(key: Key, value: GlobalStatesType[Key]) {
  const mappedKey = HookMappings[key];

  // Global states have not changed yet
  for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].before) {
    const hook = storedFunction as (anything: unknown) => unknown;
    const { status, response } = hook(value) as {
      "status"  : ExtensionStatusType;
      "response": GlobalStatesType[Key];
    };

    if (status === "stop") {
      globalStates[key] = response;

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

window[ApplicationNamespace].functions.changeGlobalStates = changeGlobalState;
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout v-if="!globalStates.customLayout">
        <Router v-if="globalStates.page !== 'none'" :page="globalStates.page" />
      </Layout>
    </template>

    <!-- In case of a global error, show this template -->
    <template #error="{ currentError }">
      <div class="min-h-vh w-full flex flex-col select-text gap-4 bg-black p-20 text-white">
        <p class="text-7xl">
          :c
        </p>
        <p class="text-balance text-2xl font-light">
          Kaede ran into a problem and needs to restart.
          You can do it by closing this window and then opening Kaede again.
        </p>
        <p class="text-xl font-light">
          {{ currentError?.value?.name }}: {{ currentError?.value?.message }}
        </p>
        <p class="break-words text-sm text-neutral-300 font-light">
          {{ currentError?.value?.stack }}
        </p>
      </div>
    </template>
  </ErrorBoundary>

  <!-- Extensions-specific error boundary -->
  <ErrorBoundary>
    <template #default>
      <ExtensionLoader />
    </template>

    <!-- In case of a global error, show this template -->
    <template #error="{ currentError }">
      <div class="min-h-vh w-full flex flex-col select-text gap-4 bg-black p-20 text-white">
        <p class="text-xl font-light">
          {{ currentError?.value?.name }}: {{ currentError?.value?.message }}
        </p>
        <p class="break-words text-sm text-neutral-300 font-light">
          {{ currentError?.value?.stack }}
        </p>
      </div>
    </template>
  </ErrorBoundary>
</template>
