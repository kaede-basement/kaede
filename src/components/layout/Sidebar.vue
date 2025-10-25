<script setup lang="ts">
import { RouteItems } from "@/constants/routes.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";
import { inject } from "vue";
import type {
  ContextGlobalStatesType,
  GlobalStatesChangerType,
} from "@/types/application/global-states.type.ts";
import {
  ApplicationNamespace,
  GlobalStatesChangerContextKey,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import { Ripple } from "m3ripple-vue";
import type { RouteType } from "@/types/application/route.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

const rippleColor = window[ApplicationNamespace].variables.rippleColor;

function setPage(page: RouteType): void {
  changeGlobalState?.("page", page);
}

// TODO: add translations
</script>

<template>
  <div class="h-vh w-20 flex flex-col items-center bg-neutral-950">
    <button
      v-for="item in RouteItems"
      :key="item.Path"
      :disabled="item.Path === globalStates?.page"
      @mousedown="() => setPage(item.Path)"
      @touchstart="() => setPage(item.Path)"
      @click="() => setPage(item.Path)"
      class="relative size-20 flex flex-col select-none items-center justify-center gap-1 text-white transition-[background-color] duration-150 disabled:bg-neutral-900"
    >
      <span
        :class="[
          item.Icon,
          'block size-6 shrink-0',
        ]"
      ></span>
      <span class="block shrink-0 text-sm">
        {{ capitalize(item.Path) }}
      </span>
      <Ripple :rippleColor="rippleColor" />
    </button>
  </div>
</template>
