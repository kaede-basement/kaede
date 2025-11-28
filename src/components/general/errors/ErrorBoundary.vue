<script setup lang="ts">
import { computed, onErrorCaptured, ref, watchEffect } from "vue";

import Errors from "@/lib/errors";
import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";

const { resetKey } = defineProps<{
  "resetKey"?: string;
}>();
const currentError = ref<NativeErrorType | undefined>(undefined);

// Listen for errors
onErrorCaptured((error: Error) => {
  currentError.value = Errors.handleCapture(error);

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
