<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from "vue";
import { log } from "@/lib/handlers/log.ts";
import { extractError } from "@/lib/helpers/extract-error.ts";

const { resetKey } = defineProps<{
  "resetKey"?: string;
}>();
const currentError = ref<{ "name": string; "message": string; "stack": string } | undefined>(undefined);

// Listen for errors
onErrorCaptured((error: Error) => {
  const extractedError = extractError(error);

  log.error(
    "A global error was captured:",
    extractedError.name + ":",
    extractedError.message + ";",
    "Stack:",
    extractedError.stack,
  );
  currentError.value = extractedError;

  // Prevent error from bubbling further
  return false;
});

// Provide an error
const slotProperties = computed(() => {
  if (!currentError.value) {
    return {};
  }

  return { currentError };
});
// Show the 'error' template if there is an error
const slotName = computed(() => (currentError.value ? "error" : "default"));

watchEffect(() => {
  if (resetKey) {
    currentError.value = undefined;
  }
});
</script>

<template>
  <slot :name="slotName" v-bind="slotProperties" />
</template>
