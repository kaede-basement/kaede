<script setup lang="ts">
import { inject } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

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
      v-show="opened"
      id="__context_menu__wrapper"
      class="__context_menu__wrapper __context-menu-disable absolute z-9000 flex flex-col gap-1 rounded-md bg-neutral-800 py-1 text-white drop-shadow-lg"
      :style="{ left: `${x + 4}px`, top: `${y + 4}px` }"
    >
      <button
        v-for="item in globalStates?.contextMenuItems"
        :key="item.name"
        :id="`__context-menu__entry-${item.icon}`"
        @click="item.action"
        class="__context_menu__entry __context-menu-disable relative flex flex-nowrap items-center gap-2 p-2 hover:bg-neutral-700"
      >
        <span
          :id="`__context-menu__entry-${item.icon}-icon`"
          :class="[item.icon, '__context-menu-disable block size-4']"
        ></span>
        <span
          :id="`__context-menu__entry-${item.icon}-label`"
          class="__context-menu-disable block whitespace-nowrap text-sm leading-none"
        >
          {{ item.name }}
        </span>
        <MaterialRipple />
      </button>
    </div>
  </Transition>
</template>