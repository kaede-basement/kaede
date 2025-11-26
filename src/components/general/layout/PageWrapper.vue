<script setup lang="ts">
import { computed, inject } from "vue";

import { GlobalStatesContextKey } from "@/constants/application.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const toRemovePaddings = computed((): boolean => {
  const custom = globalStates?.layout?.custom;
  const containsSidebar = Array.isArray(custom) && custom.includes("sidebar");

  return containsSidebar || custom === true;
});
</script>

<template>
  <div
    id="__page-wrapper"
    :class="[
      toRemovePaddings ? 'left-0' : 'left-20',
      '__page-wrapper absolute bottom-0 right-0 top-0 overflow-y-auto',
    ]"
  >
    <slot />
  </div>
</template>
