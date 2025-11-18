<script setup lang="ts">
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
</script>

<template>
  <button
    id="__home-page__launch-button"
    class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Launch
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
</template>