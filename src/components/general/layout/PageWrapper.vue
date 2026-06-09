<script setup lang="ts">
import { computed } from "vue";

import { globalStates } from "@/states/global.ts";

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
