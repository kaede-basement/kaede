<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from "vue";

import { extractError } from "@/lib/helpers/extract-error.ts";
import { handleErrorCapture } from "@/lib/helpers/handle-error-capture.ts";

const { resetKey } = defineProps<{
  "resetKey"?: string;
}>();
const currentError = ref<ReturnType<typeof extractError> | undefined>(undefined);

// Listen for errors
onErrorCaptured((error: Error) => {
  currentError.value = handleErrorCapture(error);

  // Prevent error from bubbling further
  return false;
});

// Provide an error
const slotProperties = computed(() => (
  currentError.value ? { currentError } : {}
));
// Show the 'error' template if there is an error
const slotName = computed(() => (
  currentError.value ? "error" : "default"
));

watchEffect(() => {
  if (resetKey) {
    currentError.value = undefined;
  }
});
</script>

<template>
  <slot :name="slotName" v-bind="slotProperties" />
</template>
