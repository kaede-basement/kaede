<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { inject } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { ApplicationNamespace, GlobalStatesChangerContextKey } from "@/constants/application.ts";
import { VirtualisedList } from "vue-virtualised";

const changeGlobalStates = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

function showContextMenu(event: MouseEvent): void {
  window[ApplicationNamespace].functions.showContextMenu(event);
}
function closeLogViewer(): void {
  changeGlobalStates?.("showLogs", false);
}

const rippleColor = window[ApplicationNamespace].variables.rippleColor;
const windowHeight = window.innerHeight;
</script>

<template>
  <div
    @click="closeLogViewer"
    class="absolute bottom-0 left-0 right-0 top-0 grid place-items-center bg-[theme(colors.black/.2)]"
  >
    <div
      @click.stop
      @contextmenu.prevent
      @contextmenu="showContextMenu"
      class="pointer-events-auto z-40000 h-fit max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] w-fit flex flex-col gap-2 bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div class="w-full flex flex-nowrap items-center justify-between gap-4">
        <p class="select-none text-xl font-medium leading-none">
          Logs
        </p>
        <button
          class="relative rounded-full p-1"
          @click="closeLogViewer"
        >
          <span class="i-lucide-x block size-5"></span>
          <Ripple :rippleColor="rippleColor" />
        </button>
      </div>
      <p class="select-none text-neutral-300">
        View current Kaede and Minecraft logs
      </p>
      <div class="relative max-w-200 w-[calc(100vw-128px)] overflow-auto border border-neutral-300 bg-neutral-800 text-sm font-mono">
        <VirtualisedList
          :get-node-height="() => 20"
          :viewport-height="windowHeight - 168"
          :nodes="[]"
        >
          <template #cell="slotProps">
            <p class="px-2">
              {{ slotProps.node }}
            </p>
          </template>
        </VirtualisedList>
      </div>
    </div>
  </div>
</template>