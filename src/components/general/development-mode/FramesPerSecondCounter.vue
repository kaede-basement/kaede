<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

const aborted = ref<boolean>(false);
const fps = ref<number>(0);

onMounted(() => {
  const times: Array<number> = [];

  function countFrame(): void {
    if (aborted.value) {
      return;
    }

    requestAnimationFrame(() => {
      const now = performance.now();

      while (times.length > 0 && times[0] <= now - 1000) {
        times.shift();
      }

      times.push(now);

      fps.value = times.length;

      countFrame();
    });
  }

  countFrame();
});
onUnmounted(() => {
  aborted.value = true;
});
</script>

<template>
  <div id="__dev-fps-counter__wrapper" class="fixed right-4 top-4 z-65000 bg-[theme(colors.black/.5)]">
    {{ fps }}
  </div>
</template>
