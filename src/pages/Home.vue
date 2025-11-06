<script setup lang="ts">
import { inject } from "vue";

import PageWrapper from "@/components/layout/PageWrapper.vue";
import { GlobalStatesChangerContextKey } from "@/constants/application.ts";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";

const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

async function download(): Promise<void> {}
async function run(): Promise<void> {}
</script>

<template>
  <PageWrapper>
    <div id="__home-page__wrapper" class="flex flex-col justify-start gap-2 opacity-50">
      <div id="__home-page__title w-fit">
        Home
      </div>
      <button id="__home-page__navigate-button" class="w-fit" @click="() => changeGlobalState?.('page', 'library')">
        Navigate to About
      </button>
      <button id="__home-page__download-button" class="w-fit" @click="download">uh, download</button>
      <button id="__home-page__run-button" class="w-fit" @click="run">run</button>
      <div
        v-for="(_, index) in Array.from({ length: 50 })"
        :key="index"
        :id="`__home-page__element-${index}`"
        class="text-2xl"
      >d{{ index }}</div>
    </div>
  </PageWrapper>
</template>
