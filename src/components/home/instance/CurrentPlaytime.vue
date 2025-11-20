<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
</script>

<template>
  <button
    id="__home-page__current-playtime-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2"
  >
    <span
      id="__home-page__current-playtime-icon-wrapper"
      class="grid size-12 shrink-0 place-items-center"
    >
      <span
        id="__home-page__current-playtime-icon"
        class="i-lucide-clock block size-8"
      ></span>
    </span>
    <span
      id="__home-page__current-playtime-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-playtime-information-label"
        class="block font-medium"
      >
        Playtime
      </span>
      <span
        id="__home-page__current-playtime-information-time"
        class="block text-sm text-neutral-400"
      >
        73 hours, 8 minutes, 56 seconds
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>