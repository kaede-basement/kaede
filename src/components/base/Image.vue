<script setup lang="ts">
import { ref } from "vue";

const { id, src, alt, classNames } = defineProps<{
  "id"         : string;
  "src"        : string;
  "alt"        : string;
  "classNames"?: string;
}>();
const shown = ref<boolean>(false);
</script>

<template>
  <img
    @load="shown = true"
    loading="lazy"
    :id="id"
    :alt="alt"
    :src="src"
    :class="[
      'shrink-0 block transition-[opacity] duration-300',
      shown ? 'opacity-100' : 'opacity-0',
      classNames,
    ]"
  />
</template>