<script setup lang="ts">
import CustomInput from "@/components/general/base/CustomInput.vue";
import GlobalStateHelpers from "@/lib/global-state-helpers";

const { filtering } = defineProps<{
  "filtering": string;
}>();

function handleInput(newValue: string): void {
  GlobalStateHelpers.Logs.filterBy(newValue);
}
function handleEscape(): void {
  if (filtering === "") {
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
