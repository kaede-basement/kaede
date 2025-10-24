<script setup lang="ts">
import { inject } from "vue";
import { GlobalStatesChangerContextKey } from "@/constants/application.ts";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";

const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);
</script>

<template>
  <div>
    About. Даб
  </div>
  <button @click="() => changeGlobalState?.('page', 'home')">
    Navigate to Home
  </button>
</template>
