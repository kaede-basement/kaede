<script setup lang="ts">
import MaterialRipple from "@/components/misc/MaterialRipple.vue";
</script>

<template>
  <div class="absolute left-2 top-2 flex flex-col gap-2">
    <button class="relative grid size-12 scale-90 place-items-center bg-neutral-900 opacity-0 transition-[transform,opacity] group-hover:scale-100 group-hover:opacity-100">
      <span :class="['i-lucide-search block size-5']"></span>
      <MaterialRipple />
    </button>
  </div>
</template>