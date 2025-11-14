<script setup lang="ts">
import { inject, onUnmounted, watchEffect } from "vue";

import FramesPerSecond from "@/components/general/development-mode/FramesPerSecondCounter.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { DevelopmentModeHelpers } from "@/lib/development-mode-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

watchEffect(() => {
  if (globalStates?.development?.enableDebugMode === undefined) {
    return;
  }

  if (globalStates.development.enableDebugMode) {
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
  <FramesPerSecond v-if="true || globalStates?.development?.showFPS" />
</template>
