<script setup lang="ts">
import { inject } from "vue";

import { GlobalStatesContextKey } from "@/constants/application.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
</script>

<template>
  <div
    id="__page-wrapper"
    :class="[
      globalStates?.layout?.custom ? 'left-0' : 'left-20',
      '__page-wrapper absolute bottom-0 right-0 top-0 overflow-y-auto',
    ]"
  >
    <slot />
  </div>
</template>
