<script setup lang="ts">
import { ref, type StyleValue, useTemplateRef, watch, watchEffect } from "vue";

const { id, src, alt, classNames, style } = defineProps<{
  "id"         : string;
  "src"        : string;
  "alt"        : string;
  "classNames"?: string;
  "style"     ?: StyleValue;
}>();
const shown = ref<boolean>(false);
const failed = ref(false);
const cached = ref(false);
const image = useTemplateRef<HTMLImageElement>("image");

watch(() => src, () => {
  cached.value = false;
  failed.value = false;
  shown.value = false;
});
watchEffect(() => {
  if (image.value?.complete && image.value.naturalWidth > 0) {
    cached.value = true;
    shown.value = true;
  }
}, { "flush": "post" });
</script>

<template>
  <span
    v-if="failed"
    :id="id"
    role="img"
    :aria-label="alt"
    :title="alt"
    :class="[classNames, 'grid shrink-0 place-items-center']"
    :style="style"
  >
    <span :id="id + '-fallback'" class="i-lucide-image-off pointer-events-none block size-4"></span>
  </span>
  <img
    v-else
    :key="src"
    ref="image"
    decoding="async"
    @error="failed = true"
    @load="shown = true"
    loading="lazy"
    :id="id"
    :alt="alt"
    :src="src"
    :class="[
      'shrink-0 block',
      cached ? '' : 'transition-[opacity] duration-300',
      shown ? 'opacity-100' : '!opacity-0',
      classNames,
    ]"
    :style="style"
  />
</template>
