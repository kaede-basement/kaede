<script setup lang="ts">
import CustomInput from "@/components/base/CustomInput.vue";

const { filterLogs } = defineProps<{
  "filtering" : string;
  "filterLogs": (filter: string) => void;
}>();

function handleInput(newValue: string): void {
  filterLogs(newValue);
}
function handleEscape(): void {
  filterLogs("");
}
</script>

<template>
  <custom-input
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