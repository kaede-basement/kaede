<script setup lang="ts">
import { computed, inject } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const filtering = computed((): string => globalStates?.logs?.filtering ?? "");

function handleInput(newValue: string): void {
  GlobalStateHelpers.Logs.filterBy(newValue);
}
function handleEscape(): void {
  if (filtering.value === "") {
    return;
  }

  GlobalStateHelpers.Logs.filterBy("");
}
</script>

<template>
  <CustomInput
    icon="i-lucide-list-filter"
    placeholder="Filter..."
    :debounce-time="200"
    :default-value="filtering"
    :listen-to-events="true"
    :ids="{
      'wrapper': '__log-controls__filter-wrapper',
      'icon'   : '__log-controls__filter-icon',
      'input'  : '__log-controls__filter-input',
    }"
    :on-input="handleInput"
    :on-escape="handleEscape"
  />
</template>
