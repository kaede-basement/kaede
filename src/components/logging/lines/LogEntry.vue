<script setup lang="ts">
import { computed } from "vue";

import LogHighlighter from "@/components/logging/lines/LogHighlighter.vue";
import Errors from "@/lib/errors";
import Logging from "@/lib/logging";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LogEntryInformationType } from "@/types/application/log-entry-information.type.ts";
import type { FieldTextType } from "@/types/application/log-field-text.type.ts";

/**
 * 'line' format: [date][time][target?][level] message
 */
const { line, index, searching, showDates, searchPosition, selectionIndexes } = defineProps<{
  "line"             : string | [number, string];
  "index"            : number;
  "searching"        : string;
  "showDates"       ?: boolean;
  "searchPosition"  ?: number | undefined;
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
  let safeSearching: string = searching;

  try {
    "".matchAll(new RegExp(searching, "g"));
  } catch (error: unknown) {
    const extractedError = Errors.extract(error);

    log.error(
      "Couldn't parse the searching value",
      "(stacktrace is absent to avoid huge logs flooding):",
      extractedError.name + ":",
      extractedError.message,
    );
    safeSearching = "Invalid regular expression";
  }

  const date = Logging.getLogFieldText(information.value.date, safeSearching);
  const time = Logging.getLogFieldText(information.value.time, safeSearching);
  const target = Logging.getLogFieldText(information.value.target, safeSearching);
  const level = Logging.getLogFieldText(information.value.level, safeSearching);
  const message = Logging.getLogFieldText(information.value.message, safeSearching);

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
    <p :id="`__log-entry__index-${index}`" class="__log-entry__index w-14 shrink-0 text-center text-neutral-400">
      {{ index }}
    </p>
    <div :id="`__log-entry__text-wrapper-${index}`" class="__log-entry__text-wrapper break-all">
      <span
        :id="`__log-entry__level-${index}`"
        v-if="typeof extractedInformation.level === 'string'"
        :class="[
          '__log-entry__level',
          extractedInformation.level !== ''
            && 'text-justify-last inline-block w-[70px]',
          Logging.getLogLevelColor(information.level),
        ]"
      >
        {{ extractedInformation.level }}
      </span>
      <LogHighlighter
        v-else
        :color-class="Logging.getLogLevelColor(information.level)"
        :index="index"
        :fields="extractedInformation.level.fields"
        :occurrences="extractedInformation.level.extractions"
        :search-position="searchPosition"
      />

      <template v-if="showDates">
        <span
          :id="`__log-entry__date-${index}`"
          v-if="typeof extractedInformation.date === 'string'"
          class="__log-entry__date text-neutral-400"
        >
        {{ extractedInformation.date }}
      </span>
        <LogHighlighter
          v-else
          color-class="text-neutral-400"
          :index="index"
          :fields="extractedInformation.date.fields"
          :occurrences="extractedInformation.date.extractions"
          :search-position="searchPosition"
        />
      </template>

      <span
        :id="`__log-entry__time-${index}`"
        v-if="typeof extractedInformation.time === 'string'"
        class="__log-entry__time whitespace-pre text-neutral-400"
      >
        {{ extractedInformation.time }}
      </span>
      <LogHighlighter
        v-else
        color-class="text-neutral-400"
        :index="index"
        :fields="extractedInformation.time.fields"
        :occurrences="extractedInformation.time.extractions"
        :search-position="searchPosition"
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
        :search-position="searchPosition"
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
        :search-position="searchPosition"
      />
    </div>
  </div>
</template>