<script setup lang="ts">
import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const { development } = defineProps<{
  "development": NonNullable<GlobalStatesType["development"]>;
}>();
</script>

<template>
  <FramesPerSecond v-if="development.showFPS" />
</template>
