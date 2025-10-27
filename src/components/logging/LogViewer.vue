<script setup lang="ts">
import { inject, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import { ApplicationNamespace, GlobalStatesChangerContextKey } from "@/constants/application.ts";
import { VirtualisedList } from "vue-virtualised";
import { BaseDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { log } from "@/lib/handlers/log.ts";
import LogEntry from "@/components/logging/LogEntry.vue";
import LogControls from "@/components/logging/LogControls.vue";
import MaterialRipple from "@/components/misc/MaterialRipple.vue";

const virtualList = useTemplateRef("virtualList");

const logs = shallowRef<Array<string>>(["__kaede-trigger-loading"]);
const horizontalScroll = ref<boolean>(false);
const fileData = ref<{
  "size": string | undefined;
  "time": string | undefined;
}>({ "size": undefined, "time": undefined });
const searching = ref<string>("");
// A key that re-renders virtualized list on every log viewer reopen
const mountedKey = ref<number>(Math.random());

const changeGlobalStates = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);

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
  if (node.length === 0 || horizontalScroll.value) {
    return nodeLineSize;
  }

  return nodeLineSize * Math.ceil(node.length / charactersPerLine);
}
function searchLogs(search: string): Array<number> {
  const found: Array<number> = [];
  const lowerCaseSearch = search.toLowerCase();

  searching.value = lowerCaseSearch;

  for (const [index, value] of logs.value.entries()) {
    if (value.toLowerCase().includes(lowerCaseSearch)) {
      found.push(index);
    }
  }

  return found;
}

onMounted(async () => {
  // Measuring time start
  const t1 = performance.now();

  // Notify virtualized list component that it should re-render
  mountedKey.value = Math.random();

  log.debug("LogViewer.vue mounted");
  log.debug("Getting 'latest.log' file path");
  const latestLogPath: string = await join("logs", "latest.log");

  log.debug("Reading 'latest.log' file");
  const existingLogs: string = await readTextFile(latestLogPath, {
    "baseDir": BaseDirectory.AppData,
  });

  if (existingLogs === "") {
    log.warn("Log file is empty. Are you using a debug build?");
    logs.value = ["__kaede-trigger-initial"];

    return;
  }

  const filesize = (existingLogs.length / (1024 * 1024)).toFixed(2);

  log.info("Log file is not empty");
  log.debug("Adding existing logs to the 'logs' state");
  logs.value = [
    "__kaede-trigger-initial",
    ...existingLogs.split("\n"),
  ];
  fileData.value.size = `${filesize} MB`;

  const time = ((performance.now() - t1) / 1000).toFixed(2);

  // Measuring time end
  fileData.value.time = `took ${time}s`;
});
</script>

<template>
  <div
    @contextmenu.prevent
    class="absolute bottom-0 left-0 right-0 top-0 grid place-items-center pointer-events-none"
  >
    <div
      @contextmenu.prevent
      @contextmenu="showContextMenu"
      class="rounded-md pointer-events-auto z-40000 h-fit max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] w-fit flex flex-col gap-2 bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div class="w-full flex flex-nowrap items-start justify-between gap-4 pb-2">
        <div class="flex flex-col gap-2">
          <p class="select-none text-xl font-medium leading-none">
            Logs
          </p>
          <p class="select-none text-neutral-300">
            <span>View current Kaede logs</span>
            <span v-if="fileData?.size !== undefined && fileData?.time !== undefined" class="select-text">
              ({{ fileData.size }}, {{ fileData.time }})
            </span>
          </p>
          <LogControls
            :searchLogs="searchLogs"
            :scrollToIndex="(index: number) => virtualList?.scrollToIndex?.(index)"
          />
        </div>
        <button
          class="relative rounded-md p-2 hover:bg-neutral-800"
          @click="closeLogViewer"
        >
          <span class="i-lucide-x block size-5"></span>
          <MaterialRipple />
        </button>
      </div>
      <div class="group relative max-w-200 w-[calc(100vw-128px)] overflow-auto border border-neutral-300 bg-neutral-800 text-sm font-mono">
        <VirtualisedList
          :key="`${logs.length}-${horizontalScroll}-${mountedKey}`"
          :get-node-height="getNodeHeight"
          :viewport-height="windowHeight - 208"
          :nodes="logs"
          :id="horizontalScroll ? '__virtualized-list-logs' : ''"
          ref="virtualList"
          class="w-full"
        >
          <template #cell="slotProps">
            <LogEntry
              :line="slotProps.node"
              :index="slotProps.index"
              :searching="searching"
            />
          </template>
        </VirtualisedList>
      </div>
    </div>
  </div>
</template>