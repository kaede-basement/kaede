<script setup lang="ts">
import { computed, onErrorCaptured, ref } from "vue";
import { log } from "@/lib/handlers/log.ts";

const currentError = ref<Error | undefined>(undefined);

// Listen for errors
onErrorCaptured((error: Error) => {
  log.error("A global error was captured:", JSON.stringify(error));
  currentError.value = error;

  // Prevent error from bubbling further
  return false;
});

// provide an error
const slotProperties = computed(() => {
  if (!currentError.value) {
    return {};
  }

  return { currentError };
});
// show the 'error' template if there is an error
const slotName = computed(() => (currentError.value ? "error" : "default"));
</script>

<template>
  <slot :name="slotName" v-bind="slotProperties" />
</template>
