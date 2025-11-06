<script setup lang="ts">
import { inject } from "vue";

import MaterialRipple from "@/components/misc/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import type {
  ContextGlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
</script>

<template>
  <div id="__sidebar__space-placeholder" class="h-full w-20 shrink-0"></div>
  <TransitionGroup name="fade" tag="div" class="absolute left-0 top-0 z-10000 h-vh w-20 flex flex-col items-center bg-[theme(colors.neutral.950)]">
    <button
      v-for="item in globalStates?.sidebarItems"
      :key="item.path"
      :id="`__sidebar__entry-${item.icon}-button`"
      :disabled="item.path === globalStates?.page"
      @mousedown="item.action"
      @touchstart="item.action"
      @click="item.action"
      class="relative size-20 flex shrink-0 flex-col items-center justify-center gap-1 text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.2)]"
      name="sidebar__item"
    >
      <span
        :id="`__sidebar__entry-${item.icon}-icon`"
        :class="[
          item.icon,
          'block size-6 shrink-0',
        ]"
      ></span>
      <span :id="`__sidebar__entry-${item.icon}-label`" class="block shrink-0 break-all text-balance text-sm">
        {{ item.name }}
      </span>
      <MaterialRipple />
    </button>
  </TransitionGroup>
</template>
