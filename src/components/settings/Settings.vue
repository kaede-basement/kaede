<script setup lang="ts">
import { computed } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import Tabs from "@/components/general/layout/Tabs.vue";
import { SettingsSections } from "@/constants/application.ts";
import { LazyPluginPlayground } from "@/constants/ui/pages.ts";
import { globalStates } from "@/states/global.ts";

const stateKey = "settings" as const;

const selected = computed((): string => (
  globalStates?.pages?.states?.[stateKey]?.tab ?? SettingsSections[0].id
));
</script>

<template>
  <PageWrapper>
    <div
      id="__settings-page__wrapper"
      class="h-fit sm:h-full w-full flex flex-col gap-2 py-2 pr-2"
    >
      <Tabs
        :sections="SettingsSections"
        :state-key="stateKey"
      />
      <div v-if="selected === 'general'"></div>
      <LazyPluginPlayground v-else-if="selected === 'plugin-playground'" />
    </div>
  </PageWrapper>
</template>
