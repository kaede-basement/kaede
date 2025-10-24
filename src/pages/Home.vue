<script setup lang="ts">

import { inject } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { GlobalStatesChangerContextKey } from "@/constants/application.ts";

const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

async function download() { /* TODO */ }
async function run() { /* TODO */ }
</script>

<template>
  <div>
    Home
  </div>
  <button @click="() => changeGlobalState?.('page', 'library')">
    Navigate to About
  </button>
  <button @click="download">uh, download</button>
  <button @click="run">run</button>
</template>
