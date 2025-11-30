<script setup lang="ts">
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const opened = ref<boolean>(false);

function toggleOptions(event: PointerEvent): void {
  // '0' means a left click
  if (event.button !== 0) {
    return;
  }

  opened.value = !opened.value;
}
</script>

<template>
  <button
    id="__home-page__launch-options-button"
    @pointerdown="toggleOptions"
    :class="[
      opened ? 'cursor-default bg-neutral-300' : 'bg-white',
      'relative w-fit rounded-l-sm rounded-r-md px-1 py-2 text-black',
      'transition-[background-color]',
    ]"
  >
    <span
      id="__home-page__launch-options-icon"
      :class="[
        opened ? 'rotate-180' : 'rotate-0',
        'i-lucide-chevron-down block transition-[transform]',
      ]"
    ></span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
</template>