<script setup lang="ts">
import { inject } from "vue";
import type {
  ContextGlobalStatesType,
} from "@/types/application/global-states.type.ts";
import {
  ApplicationNamespace,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import { Ripple } from "m3ripple-vue";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const rippleColor = window[ApplicationNamespace].variables.rippleColor;
</script>

<template>
  <div class="h-vh w-20 flex flex-col items-center bg-neutral-950">
    <button
      v-for="item in globalStates?.sidebarItems"
      :key="item.path"
      :disabled="item.path === globalStates?.page"
      @mousedown="item.action"
      @touchstart="item.action"
      @click="item.action"
      class="relative size-20 flex flex-col select-none items-center justify-center gap-1 text-white transition-[background-color] duration-150 disabled:bg-neutral-900"
    >
      <span
        :class="[
          item.icon,
          'block size-6 shrink-0',
        ]"
      ></span>
      <span class="block shrink-0 text-sm">
        {{ item.name }}
      </span>
      <Ripple :rippleColor="rippleColor" />
    </button>
  </div>
</template>
