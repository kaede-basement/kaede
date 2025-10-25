<script setup lang="ts">
import { RouteItems } from "@/constants/routes.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";
import { inject } from "vue";
import type {
  ContextGlobalStatesType,
  GlobalStatesChangerType,
} from "@/types/application/global-states.type.ts";
import { GlobalStatesChangerContextKey, GlobalStatesContextKey } from "@/constants/application.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

// TODO: add translations
</script>

<template>
  <div class="h-vh w-20 flex flex-col items-center bg-neutral-950">
    <button
      v-for="item in RouteItems"
      :key="item.Path"
      :disabled="item.Path === globalStates?.page"
      @click="() => changeGlobalState?.('page', item.Path)"
      class="size-20 flex flex-col items-center justify-center gap-1 text-white disabled:bg-neutral-900"
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
    </button>
  </div>
</template>
