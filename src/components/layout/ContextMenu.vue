<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { ApplicationNamespace } from "@/constants/application.ts";

const { opened, x, y } = defineProps<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>();

function restart(): void {
  window.location.reload();
}

const rippleColor = window[ApplicationNamespace].variables.rippleColor;
</script>

<template>
  <Transition name="pop">
    <div
      v-if="opened"
      id="context_menu"
      class="drop-shadow-lg context_menu __context-menu-disable absolute z-50000 flex flex-col select-none bg-neutral-800 py-1 gap-1 text-white"
      :style="{ left: `${x + 4}px`, top: `${y + 4}px` }"
    >
      <button
        @click="restart"
        class="context_menu_button __context-menu-disable relative flex flex-nowrap items-center gap-2 p-2"
      >
        <span class="__context-menu-disable block i-lucide-rotate-ccw size-4"></span>
        <span class="__context-menu-disable text-sm block leading-none">
          Restart UI
        </span>
        <Ripple :rippleColor="rippleColor" />
      </button>
    </div>
  </Transition>
</template>