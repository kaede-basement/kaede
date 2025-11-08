<script setup lang="ts">
import { appDataDir, join } from "@tauri-apps/api/path";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { computed, ref, shallowRef, watchEffect } from "vue";

import CustomButton from "@/components/base/CustomButton.vue";
import LogFilterer from "@/components/logging/controls/LogFilterer.vue";
import LogSearcher from "@/components/logging/controls/LogSearcher.vue";
import type { LogButtonType } from "@/types/ui/log-button.type.ts";

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
} = defineProps<{
  "searching"             : string;
  "searchLogs"            : (search: string) => Array<number>;
  "filtering"             : string;
  "filterLogs"            : (filter: string) => void;
  "scrollToIndex"         : (index: number) => void;
  "shouldVirtualize"      : boolean;
  "toggleShouldVirtualize": () => void;
  "horizontalScroll"      : boolean;
  "toggleHorizontalScroll": () => void;
  "selectAllLogs"         : () => void;
}>();

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
  "onClick" : toggleShouldVirtualize,
  "invert"  : shouldVirtualize,
  "hideOnSm": true,
}));
const controlButtons = computed((): Array<LogButtonType> => [
  explorerControl,
  lineBreaksControl.value,
  virtualizeControl.value,
]);

const found = shallowRef<Array<number>>([]);
const position = ref<number>(1);

function setPosition(newValue: number): void {
  position.value = newValue;
}
function setFound(newValue: Array<number>): void {
  found.value = newValue;
}

async function viewInExplorer(): Promise<void> {
  const latestLogAbsolutePath = await join(await appDataDir(), "logs", "latest.log");

  await revealItemInDir(latestLogAbsolutePath);
}

watchEffect(() => {
  if (found.value[position.value - 1] === undefined) {
    return;
  }

  scrollToIndex(found.value[position.value - 1]);
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
      />
    </div>
  </div>
</template>