<script setup lang="ts">
import MaterialRipple from "@/components/misc/MaterialRipple.vue";

const { searchLogs, scrollToIndex } = defineProps<{
  "searchLogs"   : (search: string) => Array<number>;
  "scrollToIndex": (index: number) => void;
}>();

console.log(searchLogs, scrollToIndex);
</script>

<template>
  <div class="h-8 w-full flex flex-col gap-2">
    <button class="relative grid px-2 w-fit flex flex-nowrap gap-2 items-center h-full place-items-center rounded-md bg-neutral-800">
      <span :class="['i-lucide-search block size-4']"></span>
      <span class="block">
        Search
      </span>
      <MaterialRipple />
    </button>
  </div>
</template>