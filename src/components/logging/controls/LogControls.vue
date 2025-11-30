<script setup lang="ts">
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEventListener } from "@vueuse/core";
import { computed, ref, shallowRef, watchEffect } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import LogFilterer from "@/components/logging/controls/LogFilterer.vue";
import LogSearcher from "@/components/logging/controls/LogSearcher.vue";
import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Logging from "@/lib/logging";
import type { LogButtonType } from "@/types/logging/log-button.type.ts";
import type { LogControlsType } from "@/types/logging/log-controls.type.ts";

const {
  logDatesShown,
  searchPosition,
  setSearchPosition,
  searching,
  searchLogs,
  filtering,
  filterLogs,
  scrollToIndex,
  shouldVirtualize,
  toggleShouldVirtualize,
  horizontalScroll,
  toggleHorizontalScroll,
  selectAllLogs,
  textIsInSelection,
  toggleTextSelection,
  textSelectionRange,
  setTextSelectionRange,
  logsArray,
} = defineProps<LogControlsType>();

const found = shallowRef<Array<number>>([]);
const copied = ref<boolean>(false);

function toggleShouldVirtualizeWithCursorHandling(): void {
  toggleShouldVirtualize();

  if (textIsInSelection) {
    selectTextVirtualized();
  }
}
function selectTextVirtualized(): void {
  const container = document.getElementById("__log-viewer__virtual-list-wrapper");

  if (!container) {
    return;
  }

  if (textIsInSelection) {
    setTextSelectionRange(undefined);
  }

  container.style.cursor = textIsInSelection ? "" : "text";

  toggleTextSelection();
}
function setFound(newValue: Array<number>): void {
  found.value = newValue;
}
function toggleLogDates(): void {
  GlobalStateHelpers.Logs.toggle("dates");
}
async function copyTextSelection(): Promise<void> {
  await Logging.handleVirtualTextCopy(
    copied.value,
    textSelectionRange,
    logsArray,
    (state: boolean) => copied.value = state,
  );
}
async function viewInExplorer(): Promise<void> {
  const latestLogAbsolutePath = General.cachedJoin(
    General.getCachedBaseDirectory(),
    FileStructure.Folders.Logs.Path,
    FileStructure.Folders.Logs.Files.LatestLog,
  );

  await revealItemInDir(latestLogAbsolutePath);
}

const explorerControl: LogButtonType = {
  "icon" : "i-lucide-external-link",
  "label": "View in Explorer",
  "ids"  : {
    "wrapper": "__log-controls__explorer-scroll-button",
    "icon"   : "__log-controls__explorer-scroll-icon",
    "label"  : "__log-controls__explorer-scroll-label",
  },
  "tooltip" : "View the log file in Explorer",
  "onClick" : viewInExplorer,
  "invert"  : false,
  "hideOnSm": false,
};
const lineBreaksControl = computed((): LogButtonType => ({
  "icon" : "i-lucide-text-wrap",
  "label": "Line Breaks",
  "ids"  : {
    "wrapper": "__log-controls__horizontal-scroll-button",
    "icon"   : "__log-controls__horizontal-scroll-icon",
    "label"  : "__log-controls__horizontal-scroll-label",
  },
  "tooltip" : "Toggle text wrapping",
  "onClick" : toggleHorizontalScroll,
  "invert"  : !horizontalScroll,
  "hideOnSm": true,
}));
const virtualizeControl = computed((): LogButtonType => ({
  "icon" : "i-lucide-zap",
  "label": "Virtualize",
  "ids"  : {
    "wrapper": "__log-controls__virtualization-button",
    "icon"   : "__log-controls__virtualization-icon",
    "label"  : "__log-controls__virtualization-label",
  },
  "tooltip" : "Improve viewer performance by pre-rendering only visible lines of text",
  "onClick" : toggleShouldVirtualizeWithCursorHandling,
  "invert"  : shouldVirtualize,
  "hideOnMd": true,
}));
const textSelectionControl = computed((): LogButtonType => ({
  "icon": "i-lucide-text-cursor",
  "ids" : {
    "wrapper": "__log-controls__text-selection-button",
    "icon"   : "__log-controls__text-selection-icon",
    "label"  : "__log-controls__text-selection-label",
  },
  "tooltip": "Select a text",
  "onClick": selectTextVirtualized,
  "invert" : textIsInSelection,
  "hidden" : !shouldVirtualize,
}));
const textSelectionCopyControl = computed((): LogButtonType => ({
  "icon": "i-lucide-copy",
  "ids" : {
    "wrapper": "__log-controls__text-copy-button",
    "icon"   : "__log-controls__text-copy-icon",
    "label"  : "__log-controls__text-copy-label",
  },
  "tooltip": "Copy the selected text",
  "onClick": copyTextSelection,
  "invert" : copied.value,
  "hidden" : !textSelectionRange,
}));
const logDatesControl = computed((): LogButtonType => ({
  "icon": "i-lucide-calendar",
  "ids" : {
    "wrapper": "__log-controls__dates-button",
    "icon"   : "__log-controls__dates-icon",
    "label"  : "__log-controls__dates-label",
  },
  "tooltip": "Toggle log dates",
  "onClick": toggleLogDates,
  "invert" : logDatesShown,
}));
const controlButtons = computed((): Array<LogButtonType> => [
  explorerControl,
  lineBreaksControl.value,
  virtualizeControl.value,
  textSelectionControl.value,
  textSelectionCopyControl.value,
  logDatesControl.value,
]);

watchEffect(() => {
  // Check if the searching position exists
  if (found.value?.[searchPosition - 1] === undefined) {
    return;
  }

  const logsArrayPosition = found.value[searchPosition - 1];

  // Check if index overflows the logs array
  if (logsArray.length <= logsArrayPosition) {
    return;
  }

  scrollToIndex(found.value[searchPosition - 1]);
});

useEventListener("click", (event: MouseEvent) => {
  const newRange = Logging.handleVirtualListTextSelection(
    event,
    textIsInSelection,
    textSelectionRange,
  );

  if (newRange === "save") {
    return;
  }

  setTextSelectionRange(newRange);
});
useEventListener("keydown", (event: KeyboardEvent) => {
  if (
    textIsInSelection &&
    textSelectionRange &&
    event.ctrlKey &&
    event.code === "KeyC"
  ) {
    event.preventDefault();
    copyTextSelection();

    return;
  }
});
</script>

<template>
  <div id="__log-controls__wrapper" class="h-18 w-full flex flex-col gap-2">
    <div id="__log-controls__first-row" class="h-8 w-full flex flex-nowrap gap-2">
      <LogSearcher
        v-if="shouldVirtualize"
        :searching="searching"
        :search-position="searchPosition"
        :found="found"
        :should-virtualize="shouldVirtualize"
        :select-all-logs="selectAllLogs"
        :search-logs="searchLogs"
        :set-search-position="setSearchPosition"
        :set-found="setFound"
      />
      <LogFilterer
        :filtering="filtering"
        :filter-logs="filterLogs"
      />
    </div>
    <div id="__log-controls__second-row" class="h-8 w-full flex flex-nowrap gap-2">
      <CustomButton
        v-for="controlButton in controlButtons"
        :key="controlButton.icon"
        :icon="controlButton.icon"
        :label="controlButton.label"
        :ids="controlButton.ids"
        :tooltip="controlButton.tooltip"
        :on-click="controlButton.onClick"
        :invert="controlButton.invert"
        :hide-on-sm="controlButton.hideOnSm"
        :hide-on-md="controlButton.hideOnMd"
        :hidden="controlButton.hidden"
      />
    </div>
  </div>
</template>
