<script setup lang="ts">
import { inject } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { ApplicationNamespace, GlobalStatesChangerContextKey } from "@/constants/application.ts";

const changeGlobalStates = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

function showContextMenu(event: MouseEvent): void {
  window[ApplicationNamespace].functions.showContextMenu(event);
}

console.log(changeGlobalStates);
</script>

<template>
  <div class="pointer-events-none absolute bottom-0 left-0 right-0 top-0 grid place-items-center">
    <div
      @contextmenu.prevent
      @contextmenu="showContextMenu"
      class="pointer-events-auto z-40000 h-fit max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] w-fit flex flex-col gap-2 bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div class="flex flex-nowrap w-full justify-between items-center gap-4">
        <p class="select-none text-lg font-medium leading-none">
          Logs
        </p>
        <button
          @click="() => changeGlobalStates?.('showLogs', false)"
        >
          <span class="size-5 block i-lucide-x"></span>
        </button>
      </div>
      <p class="select-none text-sm text-neutral-300">
        View current Kaede and Minecraft logs
      </p>
    </div>
  </div>
</template>