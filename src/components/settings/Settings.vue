<script setup lang="ts">
import { ref } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { LazyPluginPlayground } from "@/constants/ui/pages.ts";

const currentTab = ref<string>("general");

function handleTab(tab: string): void {
  currentTab.value = tab;
}
</script>

<template>
  <PageWrapper>
    <div
      id="__settings-page__wrapper"
      class="h-full w-full flex flex-col gap-2 py-2 pr-2"
    >
      <div
        id="__settings-page__tabs"
        class="flex flex-wrap gap-2"
      >
        <button
          id="__settings-page__tab-general"
          @click="() => handleTab('general')"
        >
          General
        </button>
        <button
          id="__settings-page__tab-discord-rpc"
          @click="() => handleTab('discord-rpc')"
        >
          Discord RPC
        </button>
        <button
          id="__settings-page__tab-plugin-playground"
          @click="() => handleTab('plugin-playground')"
        >
          Plugin Playground
        </button>
      </div>
      <div v-if="currentTab === 'general'"></div>
      <LazyPluginPlayground v-else-if="currentTab === 'plugin-playground'" />
    </div>
  </PageWrapper>
</template>
