<script setup lang="ts">
import { computed } from "vue";

import LogHighlighter from "@/components/logging/LogHighlighter.vue";

type FieldTextType = {
  "extractions": Array<string>;
  "fields"     : Array<string>;
};

/** 'line' format: [date][time][target?][level] message */
const { line, index, searching, selectionIndexes } = defineProps<{
  "line"             : string | [number, string];
  "index"            : number;
  "searching"        : string;
  "selectionIndexes"?: [number, number] | undefined;
}>();

function getFieldText(input: string, toSearch: string): string | FieldTextType {
  const lowerCasedInput = input.toLowerCase();

  if (toSearch === "" || !lowerCasedInput.includes(toSearch)) {
    return input;
  }

  const occurrences = [
    ...lowerCasedInput.matchAll(new RegExp(toSearch, "g")),
  ];
  const noOccurrenceFields = [];
  const occurrenceExtractions = [];
  let previousIndex = 0;

  for (const occurrence of occurrences) {
    const occurrenceIndex = occurrence.index;

    noOccurrenceFields.push(input.slice(
      previousIndex,
      occurrenceIndex,
    ));
    occurrenceExtractions.push(input.slice(
      occurrenceIndex,
      occurrenceIndex + toSearch.length,
    ));

    previousIndex = occurrenceIndex + toSearch.length;
  }

  noOccurrenceFields.push(input.slice(previousIndex));

  return {
    "extractions": occurrenceExtractions,
    "fields"     : noOccurrenceFields,
  };
}

const information = computed((): {
  "date"   : string;
  "time"   : string;
  "target" : string;
  "level"  : string;
  "message": string;
} => {
  const actualLine = typeof line === "string" ? line : line[1];

  const parts = actualLine.split("]");
  const current: {
    "date"   : string;
    "time"   : string;
    "target" : string;
    "level"  : string;
    "message": string;
  } = { "date": "", "time": "", "target": "", "level": "", "message": "" };

  if (actualLine.startsWith("__kaede-trigger-initial")) {
    current.target = "All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (actualLine.startsWith("__kaede-trigger-virtualized")) {
    current.target = "Virtualized mode. All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (actualLine.startsWith("__kaede-trigger-loading")) {
    current.target = "Loading your logs...";

    return current;
  }

  for (const [partIndex, part] of parts.entries()) {
    switch (partIndex) {
      case 0: {
        if (parts.length === 1) {
          current.date = part;
          break;
        }

        current.date = part + "]";

        break;
      }
      case 1: {
        current.time = part + "]";

        break;
      }
      case 2: {
        // If true, then the target part is empty
        if (part.startsWith(" ")) {
          current.level = part.trim() + "]";

          break;
        }

        if (part.startsWith("[webview:")) {
          const targetParts = part.split("/");

          current.target = "[" + targetParts[targetParts.length - 1] + "]";

          break;
        }

        current.target = part + "]";

        break;
      }
      case 3: {
        // If true, then the target part is empty
        if (current.level !== "") {
          current.message = part;

          break;
        }

        current.level = part + "]";

        break;
      }
      default: {
        // If true, then we stumbled upon a closing bracket in the message
        if (partIndex !== parts.length - 1) {
          current.message = current.message + part + "]";

          break;
        }

        current.message = current.message + part;

        break;
      }
    }
  }

  return current;
});
const extractedInformation = computed((): {
  "date"   : string | FieldTextType;
  "time"   : string | FieldTextType;
  "target" : string | FieldTextType;
  "level"  : string | FieldTextType;
  "message": string | FieldTextType;
} => {
  const date = getFieldText(information.value.date, searching);
  const time = getFieldText(information.value.time, searching);
  const target = getFieldText(information.value.target, searching);
  const level = getFieldText(information.value.level, searching);
  const message = getFieldText(information.value.message, searching);

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

function getLevelColor(level: string): string {
  if (level.includes("DEBUG")) {
    return "text-white";
  }

  if (level.includes("INFO")) {
    return "text-blue-400";
  }

  if (level.includes("WARN")) {
    return "text-yellow-400";
  }

  if (level.includes("ERROR")) {
    return "text-red-600";
  }

  return "text-neutral-400";
}
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
        :class="['__log-entry__level', getLevelColor(information.level)]"
      >
        {{ extractedInformation.level }}
      </span>
      <LogHighlighter
        v-else
        :color-class="getLevelColor(information.level)"
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