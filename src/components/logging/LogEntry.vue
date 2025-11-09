<script setup lang="ts">
import { computed } from "vue";

import LogHighlighter from "@/components/logging/LogHighlighter.vue";
import Logging from "@/lib/logging";
import type { LogEntryInformationType } from "@/types/application/log-entry-information.type.ts";
import type { FieldTextType } from "@/types/application/log-field-text.type.ts";

/**
 * 'line' format: [date][time][target?][level] message
 */
const { line, index, searching, selectionIndexes } = defineProps<{
  "line"             : string | [number, string];
  "index"            : number;
  "searching"        : string;
  "selectionIndexes"?: [number, number] | undefined;
}>();

const information = computed((): LogEntryInformationType => Logging.getLogEntryInformation(line));
const extractedInformation = computed((): {
  "date"   : string | FieldTextType;
  "time"   : string | FieldTextType;
  "target" : string | FieldTextType;
  "level"  : string | FieldTextType;
  "message": string | FieldTextType;
} => {
  const date = Logging.getLogFieldText(information.value.date, searching);
  const time = Logging.getLogFieldText(information.value.time, searching);
  const target = Logging.getLogFieldText(information.value.target, searching);
  const level = Logging.getLogFieldText(information.value.level, searching);
  const message = Logging.getLogFieldText(information.value.message, searching);

  return { date, time, target, level, message };
});
const isInRange = computed((): boolean => {
  if (!selectionIndexes) {
    return false;
  }

  const rangeFirst = Number(selectionIndexes[0]);
  const rangeSecond = Number(selectionIndexes[1]);
  const rangeStart = Math.min(rangeFirst, rangeSecond);
  const rangeEnd = Math.max(rangeFirst, rangeSecond);

  return (
    (rangeStart <= index) &&
    (rangeEnd >= index)
  );
});
</script>

<template>
  <div
    :id="`__log-entry__wrapper-${index}`"
    :class="[
      '__log-entry__wrapper',
      isInRange && 'bg-indigo-950',
      'flex shrink-0 flex-nowrap gap-1 px-1',
    ]"
  >
    <p :id="`__log-entry__index-${index}`" class="__log-entry__index w-14 shrink-0 select-none text-center text-neutral-400">
      {{ index }}
    </p>
    <div :id="`__log-entry__text-wrapper-${index}`" class="__log-entry__text-wrapper break-all">
      <span
        :id="`__log-entry__level-${index}`"
        v-if="typeof extractedInformation.level === 'string'"
        :class="['__log-entry__level', Logging.getLogLevelColor(information.level)]"
      >
        {{ extractedInformation.level }}
      </span>
      <LogHighlighter
        v-else
        :color-class="Logging.getLogLevelColor(information.level)"
        :index="index"
        :fields="extractedInformation.level.fields"
        :occurrences="extractedInformation.level.extractions"
      />

      <span
        :id="`__log-entry__date-${index}`"
        v-if="typeof extractedInformation.date === 'string'"
        class="__log-entry__date whitespace-pre text-neutral-400"
      >
        {{ extractedInformation.date }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-400"
        :index="index"
        :fields="extractedInformation.date.fields"
        :occurrences="extractedInformation.date.extractions"
      />

      <span
        :id="`__log-entry__time-${index}`"
        v-if="typeof extractedInformation.time === 'string'"
        class="__log-entry__time text-neutral-400"
      >
        {{ extractedInformation.time }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-400"
        :index="index"
        :fields="extractedInformation.time.fields"
        :occurrences="extractedInformation.time.extractions"
      />

      <span
        :id="`__log-entry__target-${index}`"
        v-if="typeof extractedInformation.target === 'string'"
        class="__log-entry__target text-lime-300"
      >
        {{ extractedInformation.target }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-lime-300"
        :index="index"
        :fields="extractedInformation.target.fields"
        :occurrences="extractedInformation.target.extractions"
      />

      <span
        :id="`__log-entry__message-${index}`"
        v-if="typeof extractedInformation.message === 'string'"
        class="__log-entry__message text-neutral-300"
      >
        {{ extractedInformation.message }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-300"
        :index="index"
        :fields="extractedInformation.message.fields"
        :occurrences="extractedInformation.message.extractions"
      />
    </div>
  </div>
</template>