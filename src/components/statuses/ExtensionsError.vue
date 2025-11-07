<script setup lang="ts">
import { computed, type Ref } from "vue";

import type { NativeErrorType } from "@/types/application/error-handling.type.ts";

const { error } = defineProps<{
  "error": Ref<
    NativeErrorType | undefined,
    NativeErrorType | undefined
  > | undefined;
}>();
const information = computed((): NativeErrorType => {
  return {
    "name"   : error?.value?.name || "Unknown",
    "message": error?.value?.message || "no message provided",
    "stack"  : error?.value?.stack || "No stacktrace?",
  };
});
</script>

<template>
  <div id="__extension-error__wrapper" class="min-h-vh w-full flex flex-col select-text gap-4 bg-black p-20 text-white">
    <p id="__extension-error__message" class="text-xl font-light">
      {{ information.name }}: {{ information.message }}
    </p>
    <p id="__extension-error__stack" class="break-words text-sm text-neutral-300 font-light">
      {{ information.stack }}
    </p>
  </div>
</template>