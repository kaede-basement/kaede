<script setup lang="ts">
import { inject, onUnmounted, watchEffect } from "vue";

import { GlobalStatesContextKey } from "@/constants/application.ts";
import { DevelopmentModeHelpers } from "@/lib/development-mode-helpers";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

watchEffect(() => {
  if (globalStates?.development?.enableDebugMode) {
    DevelopmentModeHelpers.enableDebugMode();

    return;
  }

  DevelopmentModeHelpers.disableDebugMode();
});

onUnmounted(() => {
  DevelopmentModeHelpers.disableDebugMode();
});
</script>

<template>
  <NativeReloadKeyBinds v-if="globalStates?.development?.enableNativeReloadKeyBinds" />
  <FpsCounter v-if="globalStates?.development?.showFPS" />
</template>
