<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { inject, onMounted, onUnmounted, shallowRef } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { ApplicationNamespace, GlobalStatesChangerContextKey } from "@/constants/application.ts";
import { VirtualisedList } from "vue-virtualised";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { log } from "@/lib/handlers/log.ts";
import LogEntry from "@/components/logging/LogEntry.vue";

const logs = shallowRef<Array<string>>(["__kaede-trigger-loading"]);

const changeGlobalStates = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

const rippleColor = window[ApplicationNamespace].variables.rippleColor;
// We do not care about window size changes here, since user can just reopen log viewer
const windowHeight = window.innerHeight;

/*
 * Subtract 128 to exclude the margins and paddings
 *          16 to exclude the approximate scrollbar width
 *          64 to exclude the line number width
 */
const virtualScrollContainerTextWidth = Math.min(800, window.innerWidth - 128) - 16 - 64;

/*
 * ~7.6 is a magical number that was obtained by dividing one line of a mono text by the count of its characters.
 * We are using 'Math#ceil' instead of 'Math#floor'
 * because we left some room for characters when we rounded ~7.6 to 8
 */
const charactersPerLine = Math.ceil(virtualScrollContainerTextWidth / 8);
const nodeLineSize = 20;

function showContextMenu(event: MouseEvent): void {
  window[ApplicationNamespace].functions.showContextMenu(event);
}
function closeLogViewer(): void {
  changeGlobalStates?.("showLogs", false);
}
function getNodeHeight(node: string): number {
  if (node.length === 0) {
    return nodeLineSize;
  }

  return nodeLineSize * Math.ceil(node.length / charactersPerLine);
}

onMounted(async () => {
  log.debug("LogViewer.vue mounted");
  log.debug("Getting 'latest.log' file path");
  const latestLogPath: string = await join("logs", "latest.log");

  log.debug("Reading 'latest.log' file");
  const existingLogs: string = await readTextFile(latestLogPath, {
    "baseDir": BaseDirectory.AppData,
  });

  log.debug("Adding existing logs to the 'logs' state");
  logs.value = [
    "__kaede-trigger-initial",
    ...existingLogs.split("\n"),
  ];
});

onUnmounted(() => {
  // Clean array references (I'm not sure if it works this way though)
  logs.value = [];
});
</script>

<template>
  <div
    @click="closeLogViewer"
    @contextmenu.prevent
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
          class="relative rounded-full p-1 hover:bg-neutral-800"
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
          :key="logs.length"
          :get-node-height="getNodeHeight"
          :viewport-height="windowHeight - 168"
          :nodes="logs"
        >
          <template #cell="slotProps">
            <LogEntry :line="slotProps.node" :index="slotProps.index" />
          </template>
        </VirtualisedList>
      </div>
    </div>
  </div>
</template>