<script setup lang="ts">

import { inject } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { GlobalStatesChangerContextKey } from "@/constants/application.ts";
import PageWrapper from "@/components/layout/PageWrapper.vue";

const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

async function download() { /* TODO */ }
async function run() { /* TODO */ }
</script>

<template>
  <PageWrapper>
    <div class="flex flex-col justify-start gap-2 opacity-50">
      <div class="bg-white">
        Home
      </div>
      <button class="bg-white w-fit" @click="() => changeGlobalState?.('page', 'library')">
        Navigate to About
      </button>
      <button class="bg-white w-fit" @click="download">uh, download</button>
      <button class="bg-white w-fit" @click="run">run</button>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
      <div class="text-2xl">d</div>
    </div>
  </PageWrapper>
</template>
