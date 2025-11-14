<script setup lang="ts">
import { onUnmounted, watchEffect } from "vue";

import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import { DevelopmentModeHelpers } from "@/lib/development-mode-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

const { development } = defineProps<{
  "development": NonNullable<GlobalStatesType["development"]>;
}>();

watchEffect(() => {
  if (development.enableDebugMode) {
    DevelopmentModeHelpers.enableDebugMode();

    return;
  }

  // Disable debug mode only if it was enabled
  if (log.debug === log["__debug-defined"]) {
    DevelopmentModeHelpers.disableDebugMode();
  }
});

onUnmounted(() => {
  DevelopmentModeHelpers.disableDebugMode();
});
</script>

<template>
  <FramesPerSecond v-if="development.showFPS" />
</template>
