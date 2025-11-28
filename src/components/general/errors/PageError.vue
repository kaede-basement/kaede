<script setup lang="ts">
import { computed, inject, type Ref } from "vue";

import { TranslationsContextKey } from "@/constants/application.ts";
import type { NativeErrorType } from "@/types/errors/error-handling.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

const Translations = inject<TranslationsType>(TranslationsContextKey);

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
  <div id="__layout__error-wrapper" class="h-full w-full flex flex-col select-text gap-4 bg-black py-8 pl-28 pr-8 text-white">
    <p id="__layout__error-message" class="text-xl font-light">
      <span id="__layout__error-message-intro">{{ Translations?.Messages?.["general.errors.page-error.message"] }}</span>
      <span id="__layout__error-message-error">{{ information.name }}: {{ information.message }}</span>
    </p>
    <p id="__layout__error-stack" class="break-words text-sm text-neutral-300 font-light">
      {{ information.stack }}
    </p>
  </div>
</template>
