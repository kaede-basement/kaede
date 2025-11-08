<script setup lang="ts">
import { appDataDir, join } from "@tauri-apps/api/path";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEventListener } from "@vueuse/core";
import { computed, ref, shallowRef, watchEffect } from "vue";

import CustomButton from "@/components/base/CustomButton.vue";
import LogFilterer from "@/components/logging/controls/LogFilterer.vue";
import LogSearcher from "@/components/logging/controls/LogSearcher.vue";
import {
  handleVirtualListTextSelection,
} from "@/lib/logging/scopes/handle-virtual-list-text-selection.ts";
import { handleVirtualTextCopy } from "@/lib/logging/scopes/handle-virtual-text-copy.ts";
import type { LogButtonType } from "@/types/ui/log-button.type.ts";
import type { LogControlsType } from "@/types/ui/log-controls.type.ts";

const {
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
const position = ref<number>(1);
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

  container.style.cursor = textIsInSelection ? "default" : "text";

  toggleTextSelection();
}
function setPosition(newValue: number): void {
  position.value = newValue;
}
function setFound(newValue: Array<number>): void {
  found.value = newValue;
}
async function copyTextSelection(): Promise<void> {
  await handleVirtualTextCopy(
    copied.value,
    textSelectionRange,
    logsArray,
    (state: boolean) => copied.value = state,
  );
}
async function viewInExplorer(): Promise<void> {
  const latestLogAbsolutePath = await join(await appDataDir(), "logs", "latest.log");

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
  "hideOnSm": true,
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
const controlButtons = computed((): Array<LogButtonType> => [
  explorerControl,
  lineBreaksControl.value,
  virtualizeControl.value,
  textSelectionControl.value,
  textSelectionCopyControl.value,
]);

watchEffect(() => {
  if (found.value[position.value - 1] === undefined) {
    return;
  }

  scrollToIndex(found.value[position.value - 1]);
});

useEventListener("click", (event: MouseEvent) => {
  const newRange = handleVirtualListTextSelection(
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
  <div id="__log-controls__wrapper" class="h-18 w-full flex flex-col select-none gap-2">
    <div id="__log-controls__first-row" class="h-8 w-full flex flex-nowrap gap-2">
      <log-searcher
        :searching="searching"
        :position="position"
        :found="found"
        :should-virtualize="shouldVirtualize"
        :select-all-logs="selectAllLogs"
        :search-logs="searchLogs"
        :set-position="setPosition"
        :set-found="setFound"
      />
      <log-filterer
        :filtering="filtering"
        :filter-logs="filterLogs"
      />
    </div>
    <div id="__log-controls__second-row" class="h-8 w-full flex flex-nowrap gap-2">
      <custom-button
        v-for="controlButton in controlButtons"
        :key="controlButton.icon"
        :icon="controlButton.icon"
        :label="controlButton.label"
        :ids="controlButton.ids"
        :tooltip="controlButton.tooltip"
        :on-click="controlButton.onClick"
        :invert="controlButton.invert"
        :hide-on-sm="controlButton.hideOnSm"
        :hidden="controlButton.hidden"
      />
    </div>
  </div>
</template>