<script setup lang="ts">
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import GlobalStateHelpers from "@/lib/global-state-helpers";

async function download(): Promise<void> {}
async function run(): Promise<void> {}
</script>

<template>
  <PageWrapper>
    <div id="__home-page__wrapper" class="flex flex-col justify-start gap-2 opacity-50">
      <div id="__home-page__title w-fit">
        Home
      </div>
      <button id="__home-page__navigate-button" class="w-fit" @click="() => GlobalStateHelpers.Pages.navigate('library')">
        Navigate to Library
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
