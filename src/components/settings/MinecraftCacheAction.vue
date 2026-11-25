<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { inject, ref } from "vue";

import { TranslationsContextKey } from "@/constants/application.ts";
import English from "@/constants/english.json";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const translations = inject<TranslationsStateType>(TranslationsContextKey);
const pending = ref(false);
const feedback = ref("");

function label(key: keyof typeof English.Messages): string {
  return translations?.value.Messages[key] ?? English.Messages[key];
}
async function clearCache(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  feedback.value = "";
  try {
    await invoke("clear_mod_cache");
    feedback.value = label("settings.minecraft.cache-cleared");
  } catch (error) {
    feedback.value = label("settings.minecraft.cache-error") + " " + String(error);
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <button
    id="__settings-page__clear-mod-cache"
    class="self-start rounded px-3 py-2 hover:bg-neutral-600 disabled:opacity-60"
    :disabled="pending"
    @click="clearCache"
  >
    {{ label(pending ? "settings.minecraft.clearing-cache" : "settings.minecraft.clear-cache") }}
  </button>
  <span id="__settings-page__cache-feedback" role="status">{{ feedback }}</span>
</template>
