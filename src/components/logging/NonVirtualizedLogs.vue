<script setup lang="ts">
import { useTemplateRef } from "vue";

import LogEntry from "@/components/logging/LogEntry.vue";

const target = useTemplateRef("target");

const { logs, searching, horizontalScroll } = defineProps<{
  "logs"            : Array<string | [number, string]>;
  "searching"       : string;
  "horizontalScroll": boolean;
}>();

defineExpose({ "nonVirtualizedLogsTarget": target });
</script>

<template>
  <div
    :id="horizontalScroll ? '__non-virtualized-list-logs' : ''"
    ref="target"
    class="h-[calc(100vh-248px)] w-fit"
  >
    <template
      v-for="(entry, index) in logs"
      :key="index"
    >
      <LogEntry
        :line="entry"
        :index="index"
        :searching="searching"
      />
    </template>
  </div>
</template>