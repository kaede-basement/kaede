<script setup lang="ts">
import { ask } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { computed, inject, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import { VirtualisedList } from "vue-virtualised";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import LogControls from "@/components/logging/controls/LogControls.vue";
import LogEntry from "@/components/logging/lines/LogEntry.vue";
import NonVirtualizedLogs from "@/components/logging/NonVirtualizedLogs.vue";
import { ApplicationNamespace, GlobalStatesContextKey } from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const virtualList = useTemplateRef("virtualList");
const nonVirtualList = useTemplateRef("nonVirtualList");

const logs = shallowRef<Array<string>>(["__kaede-trigger-loading"]);
const fileData = ref<{
  "size": string | undefined;
  "time": string | undefined;
}>({ "size": undefined, "time": undefined });
const searching = ref<string>("");
// Takes indexes from the relative matches array (example: [0, 1, 2, ...])
const searchPosition = ref<number>(1);
// Takes indexes from the logs array (example: [4, 23, 95, ...])
const absoluteSearchPosition = ref<number | undefined>(undefined);
// A key that re-renders virtualized list on every log viewer reopen
const mountedKey = ref<number>(Math.random());
const textSelected = ref<boolean>(false);
const currentTextSelection = ref<[number, number] | undefined>(undefined);

const filtering = computed((): string => globalStates?.logs?.filtering ?? "");
const filteredLogs = computed((): (Array<[number, string]> | undefined) => {
  if (filtering.value === "") {
    return undefined;
  }

  const filteredArray: Array<[number, string]> = [];

  for (const [_index, _log] of logs.value.entries()) {
    if (_log.toLowerCase().includes(filtering.value.toLowerCase())) {
      filteredArray.push([_index, _log]);
    }
  }

  return filteredArray;
});

// We do not care about window size changes here, since user can just reopen log viewer
const windowHeight = window.innerHeight;

/*
 * Subtract 128 to exclude the margins and paddings
 *          16 to exclude the approximate scrollbar width
 *          64 to exclude the line number width
 */
const virtualScrollContainerTextWidth = Math.min(800, window.innerWidth - 128) - 16 - 64;

/*
 * ~7.6 is a magical number that was obtained by dividing one line of a mono text
 * by the count of its characters.
 * We are using 'Math#ceil' instead of 'Math#floor'
 * because we left some room for characters when we rounded ~7.6 to 8
 */
const charactersPerLine = Math.ceil(virtualScrollContainerTextWidth / 8);
const nodeLineSize = 20;

function scrollToIndex(index: number): void {
  virtualList?.value?.scrollToIndex?.(index);
}
function setSearchPosition(newValue: number, newAbsoluteValue: number | undefined): void {
  searchPosition.value = newValue;
  absoluteSearchPosition.value = newAbsoluteValue;
}
function setTextSelectionRange(newValue: [number, number] | undefined): void {
  currentTextSelection.value = newValue;
}
function toggleTextSelection(): void {
  textSelected.value = !textSelected.value;
}
function showContextMenu(event: MouseEvent): void {
  window[ApplicationNamespace].libs.ContextMenu.show(event);
}
function closeLogViewer(): void {
  GlobalStateHelpers.Logs.toggle("show", false);
}
function getNodeHeight(node: string | [number, string]): number {
  const actualNodeLine = typeof node === "string" ? node : node[1];

  if (actualNodeLine.length === 0 || !globalStates?.logs?.lineBreaks) {
    return nodeLineSize;
  }

  return nodeLineSize * Math.ceil(actualNodeLine.length / charactersPerLine);
}
function searchLogs(searchValue: string): Array<number> {
  const found: Array<number> = [];
  const lowerCaseSearch = searchValue.toLowerCase();
  const currentLogsArray = filteredLogs.value ?? logs.value;

  searching.value = lowerCaseSearch;

  for (const [index, value] of currentLogsArray.entries()) {
    const actualValue = typeof value === "string" ? value : value[1];

    if (actualValue.toLowerCase().includes(lowerCaseSearch)) {
      found.push(index);
    }
  }

  return found;
}
function filterLogs(filterValue: string): void {
  GlobalStateHelpers.Logs.filterBy(filterValue);
}
async function toggleVirtualization(): Promise<void> {
  if (globalStates?.logs?.virtualized && logs.value.length >= 512) {
    const answer = await ask(
      "Virtualization was enabled because your log file is big. " +
      "Disabling it may freeze your launcher for a bit. Do you want to disable virtualization?",
      {
        "title": "Kaede",
        "kind" : "warning",
      },
    );

    if (!answer) {
      return;
    }
  }

  GlobalStateHelpers.Logs.toggle("virtualized");
}
function selectAllText(): void {
  const logsContainer = nonVirtualList.value?.nonVirtualizedLogsTarget;

  if (!logsContainer) {
    return;
  }

  const range = document.createRange();

  range.selectNode(logsContainer);
  window.getSelection()?.removeAllRanges?.();
  window.getSelection()?.addRange?.(range);
}

onMounted(async () => {
  // Measuring time start
  const t1 = performance.now();

  // Notify virtualized list component that it should re-render
  mountedKey.value = Math.random();

  log.debug("LogViewer.vue mounted");
  log.debug("Getting 'latest.log' file path");
  const latestLogPath: string | undefined = globalStates?.fileSystem?.files?.log;

  if (!latestLogPath) {
    log.warn("'latest.log' file path is missing");

    return;
  }

  log.debug("Reading 'latest.log' file");
  const existingLogs: string = await readTextFile(latestLogPath);

  if (existingLogs === "") {
    log.warn("Log file is empty");
    logs.value = ["__kaede-trigger-initial"];

    return;
  }

  // If the log file is big (>=32 KBs), open it with the virtualized list
  if (existingLogs.length >= 32_768) {
    log.debug(`Log file is too big (${existingLogs.length} bytes), using a virtualized list`);
    GlobalStateHelpers.Logs.toggle("virtualized", true);
  }

  const filesize = (existingLogs.length / (1024 * 1024)).toFixed(3);

  log.info("Log file is not empty");
  log.debug("Adding existing logs to the 'logs' state");
  logs.value = [
    globalStates?.logs?.virtualized ? "__kaede-trigger-virtualized" : "__kaede-trigger-initial",
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
    id="__log-viewer__wrapper"
    @contextmenu.prevent
    class="absolute bottom-0 left-0 right-0 top-0 z-40000 grid place-items-center bg-[theme(colors.black/.5)]"
  >
    <div
      id="__log-viewer__inner"
      @contextmenu.prevent
      @contextmenu="showContextMenu"
      class="h-fit max-h-[calc(100vh-64px)] max-w-[calc(100vw-64px)] w-fit flex flex-col gap-2 rounded-md bg-neutral-900 p-4 text-white drop-shadow-lg"
    >
      <div id="__log-viewer__information-wrapper" class="w-full flex shrink-0 flex-nowrap items-start justify-between gap-4 pb-2">
        <div id="__log-viewer__information-text-wrapper" class="flex flex-col gap-2">
          <p id="__log-viewer__information-title" class="text-xl font-medium leading-none">
            Logs
          </p>
          <p id="__log-viewer__information-subtitle" class="text-neutral-300">
            <span id="__log-viewer__information-subtitle-static">View Kaede logs</span>
            <span
              v-if="fileData?.size !== undefined && fileData?.time !== undefined"
              id="__log-viewer__information-subtitle-file-data"
              class="text-neutral-400"
            >
              ({{ fileData.size }}, {{ fileData.time }})
            </span>
          </p>
          <LogControls
            :log-dates-shown="globalStates?.logs?.dates === true"
            :search-position="searchPosition"
            :set-search-position="setSearchPosition"
            :searching="searching"
            :search-logs="searchLogs"
            :filtering="filtering"
            :filter-logs="filterLogs"
            :scroll-to-index="scrollToIndex"
            :should-virtualize="globalStates?.logs?.virtualized === true"
            :toggle-should-virtualize="toggleVirtualization"
            :horizontal-scroll="globalStates?.logs?.lineBreaks === false"
            :toggle-horizontal-scroll="() => GlobalStateHelpers.Logs.toggle('lineBreaks')"
            :select-all-logs="selectAllText"
            :text-is-in-selection="textSelected"
            :toggle-text-selection="toggleTextSelection"
            :text-selection-range="currentTextSelection"
            :set-text-selection-range="setTextSelectionRange"
            :logs-array="filteredLogs ?? logs"
          />
        </div>
        <button
          id="__log-viewer__close-logs-button"
          class="relative rounded-md p-2 hover:bg-neutral-800"
          @click="closeLogViewer"
        >
          <span id="__log-viewer__close-logs-icon" class="i-lucide-x block size-5"></span>
          <MaterialRipple />
        </button>
      </div>
      <div
        id="__log-viewer__virtual-list-wrapper"
        class="group relative max-w-320 w-[calc(100vw-128px)] overflow-auto border border-neutral-300 bg-neutral-950 text-sm font-mono"
      >
        <VirtualisedList
          v-if="globalStates?.logs?.virtualized"
          :key="`${logs.length}-${globalStates?.logs?.lineBreaks}-${filtering}-${mountedKey}`"
          :get-node-height="getNodeHeight"
          :viewport-height="windowHeight - 248"
          :nodes="filteredLogs ?? logs"
          :id="globalStates?.logs?.lineBreaks ? '' : '__virtualized-list-logs'"
          ref="virtualList"
          class="w-full"
        >
          <template #cell="slotProps">
            <LogEntry
              :line="slotProps.node"
              :index="typeof slotProps.node === 'string'
                ? slotProps.index
                : slotProps.node[0]"
              :searching="searching"
              :show-dates="globalStates?.logs?.dates"
              :search-position="absoluteSearchPosition"
              :selection-indexes="currentTextSelection"
            />
          </template>
        </VirtualisedList>
        <NonVirtualizedLogs
          v-else
          ref="nonVirtualList"
          :logs="filteredLogs ?? logs"
          :searching="searching"
          :show-dates="globalStates?.logs?.dates"
          :horizontal-scroll="globalStates?.logs?.lineBreaks === false"
        />
      </div>
    </div>
  </div>
</template>
