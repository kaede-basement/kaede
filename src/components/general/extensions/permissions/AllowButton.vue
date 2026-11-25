<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { PermissionCooldownMs } from "@/lib/permissions/request-permissions.ts";

const { onClick } = defineProps<{
  "onClick": () => void;
}>();

// No one wants to accidentally allow an extension permission
const timeout = ref<number>(PermissionCooldownMs);
let deadline: number;
let frame: number;

function decrease(): void {
  timeout.value = deadline - performance.now();
  if (timeout.value > 0) {
    frame = requestAnimationFrame(decrease);
  }
}
onMounted(() => {
  deadline = performance.now() + PermissionCooldownMs;
  decrease();
});
onUnmounted(() => cancelAnimationFrame(frame));
</script>

<template>
  <button
    :disabled="timeout > 0"
    id="__extensions-loader__permission-request-allow-wrapper"
    @click="onClick"
    class="group relative flex flex-nowrap rounded-md bg-neutral-800 px-3 py-1 transition-[opacity,background-color] disabled:bg-red-800 disabled:opacity-60"
  >
    <span
      id="__extensions-loader__permission-request-allow-label"
      class="text-white transition-[color] group-disabled:text-red-300"
    >
      Yes
    </span>
    <span
      v-if="timeout > 0"
      id="__extensions-loader__permission-request-allow-timer-label"
      class="text-red-300"
    >
      {{ `, ${(timeout / 1000).toFixed(2)}` }}
    </span>
    <MaterialRipple v-if="timeout <= 0" />
  </button>
</template>
