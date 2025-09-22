<script setup lang="ts">
import { RouterView } from "@kitbag/router";
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import { createInstance } from "@module-federation/enhanced/runtime";
import { defineAsyncComponent } from "vue";

const mf = createInstance({
  "name"   : "mf_host",
  "remotes": [],
});

mf.registerRemotes([
  {
    "name" : "remote1",
    "alias": "remote-1",
    "entry": "https://unpkg.com/module-federation-rslib-provider@latest/dist/mf/mf-manifest.json",
  },
]);

const Huh = defineAsyncComponent(async () => {
  const { MyButton } = await mf.loadRemote("remote1") as { "MyButton": unknown };

  return {
    "default": MyButton,
  };
});
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout>
        <RouterView />
        <Huh />
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
</template>
