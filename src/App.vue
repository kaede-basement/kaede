<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ExtensionLoader from "@/components/extensions/ExtensionLoader.vue";
import { shallowReactive } from "vue";
import type { RouteType } from "@/types/application/route.type.ts";
import Router from "@/components/layout/Router.vue";

const globalStates = shallowReactive<{
  "customLayout": boolean;
  "page"        : RouteType;
  "pageStates"  : Record<RouteType, object>;
}>({
  "customLayout": false,
  "page"        : "home",
  "pageStates"  : {
    "home"    : {},
    "library" : {},
    "settings": { "tab": "extensions" },
    "none"    : {},
  },
});
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
