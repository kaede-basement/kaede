<script setup lang="ts">
import { inject } from "vue";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import MaterialRipple from "@/components/misc/MaterialRipple.vue";

const { opened, x, y } = defineProps<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>();

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
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
        v-for="item in globalStates?.contextMenuItems"
        :key="item.name"
        @click="item.action"
        class="context_menu_button __context-menu-disable relative flex flex-nowrap items-center gap-2 p-2"
      >
        <span :class="[item.icon, '__context-menu-disable block size-4']"></span>
        <span class="__context-menu-disable text-sm block leading-none">
          {{ item.name }}
        </span>
        <MaterialRipple />
      </button>
    </div>
  </Transition>
</template>