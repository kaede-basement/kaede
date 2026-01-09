<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { readTextFile } from "@tauri-apps/plugin-fs";
import { computed, inject, nextTick, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import { VirtualisedList } from "vue-virtualised";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import LogControls from "@/components/logging/controls/LogControls.vue";
import LogEntry from "@/components/logging/lines/LogEntry.vue";
import NonVirtualizedLogs from "@/components/logging/NonVirtualizedLogs.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Logging from "@/lib/logging";
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
// Keeps track of index range text selections in virtualized mode
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

// We do not care about window size changes here, since user can just reopen the log viewer
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

onMounted(async () => {
  // Measuring time start
  const t1 = performance.now();

  // Notify virtualized list component that it should re-render
  mountedKey.value = Math.random();

  log.debug("LogViewer.vue mounted");
  const latestLogAbsolutePath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  log.debug("Reading 'latest.log' file");
  const existingLogs: string = await readTextFile(latestLogAbsolutePath);

  if (existingLogs === "") {
    log.warn(__PRE_BUNDLED_FILENAME__, "Log file is empty");
    logs.value = ["__kaede-trigger-initial"];

    return;
  }

  // If the log file is big (>=32 KBs), open it with the virtualized list
  if (existingLogs.length >= 32_768) {
    log.debug(`Log file is too big (${existingLogs.length} bytes), using a virtualized list`);
    GlobalStateHelpers.Logs.toggle("virtualized", true);
  }

  const filesize = (existingLogs.length / (1024 * 1024)).toFixed(3);

  log.info(__PRE_BUNDLED_FILENAME__, "Log file is not empty");
  log.debug(__PRE_BUNDLED_FILENAME__, "Adding existing logs to the 'logs' state");
  logs.value = [
    globalStates?.logs?.virtualized ? "__kaede-trigger-virtualized" : "__kaede-trigger-initial",
    ...existingLogs.split("\n"),
  ];
  fileData.value.size = `${filesize} MB`;

  const time = ((performance.now() - t1) / 1000).toFixed(2);

  // Measuring time end
  fileData.value.time = `took ${time}s`;

  await nextTick();
  // Virtual list does not scroll to its end unless we wait two (???) Vue ticks
  await nextTick();

  virtualList.value?.scrollToEnd?.();
});
</script>

<template>
  <div
    id="__log-viewer__wrapper"
    @contextmenu.prevent
    class="absolute bottom-0 left-0 right-0 top-0 z-6000 grid place-items-center bg-[theme(colors.black/.5)]"
  >
    <div
      id="__log-viewer__inner"
      @contextmenu.prevent
      @contextmenu="GlobalStateHelpers.showContextMenu"
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
            :search-position="searchPosition"
            :set-search-position="setSearchPosition"
            :searching="searching"
            :search-logs="searchLogs"
            :filtering="filtering"
            :scroll-to-index="scrollToIndex"
            :select-all-logs="() => Logging.selectAllText(nonVirtualList?.nonVirtualizedLogsTarget)"
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
          :horizontal-scroll="globalStates?.logs?.lineBreaks === false"
        />
      </div>
    </div>
  </div>
</template>
