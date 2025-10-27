<script setup lang="ts">
import { computed } from "vue";
import LogHighlighter from "@/components/logging/LogHighlighter.vue";

type FieldTextType = {
  "extractions": Array<string>;
  "fields"     : Array<string>;
};

/** Format: [date][time][target?][level] message */
const { line, index, searching } = defineProps<{
  "line"     : string;
  "index"    : number;
  "searching": string;
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

  /*
   * const _temp = [];
   *
   * for (const [_index, occurrenceExtraction] of occurrenceExtractions.entries()) {
   *   _temp.push(noOccurrenceFields[_index], occurrenceExtraction);
   * }
   *
   * _temp.push(noOccurrenceFields[noOccurrenceFields.length - 1]);
   */

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
  const parts = line.split("]");
  const current: {
    "date"   : string;
    "time"   : string;
    "target" : string;
    "level"  : string;
    "message": string;
  } = { "date": "", "time": "", "target": "", "level": "", "message": "" };

  if (line.startsWith("__kaede-trigger-initial")) {
    current.target = "All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (line.startsWith("__kaede-trigger-loading")) {
    current.target = "Loading your logs...";

    return current;
  }

  for (const [index, part] of parts.entries()) {
    switch (index) {
      case 0: {
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
        if (index !== parts.length - 1) {
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
  <div class="flex flex-nowrap gap-1 px-1 shrink-0">
    <p class="w-14 shrink-0 select-none text-center text-neutral-400">
      {{ index - 1 }}
    </p>
    <div id="__virtualized-list-logs__text" class="break-anywhere">
      <span
        v-if="typeof extractedInformation.level === 'string'"
        :class="[getLevelColor(information.level)]"
      >
        {{ extractedInformation.level }}
      </span>
      <LogHighlighter
        v-else
        :fields="extractedInformation.level.fields"
        :occurrences="extractedInformation.level.extractions"
      />

      <span v-if="typeof extractedInformation.date === 'string'" class="text-neutral-400">
        {{ extractedInformation.date }}
      </span>
      <LogHighlighter
        v-else
        :fields="extractedInformation.date.fields"
        :occurrences="extractedInformation.date.extractions"
      />

      <span v-if="typeof extractedInformation.time === 'string'" class="text-neutral-400">
        {{ extractedInformation.time }}
      </span>
      <LogHighlighter
        v-else
        :fields="extractedInformation.time.fields"
        :occurrences="extractedInformation.time.extractions"
      />

      <span v-if="typeof extractedInformation.target === 'string'" class="text-lime-300">
        {{ extractedInformation.target }}
      </span>
      <LogHighlighter
        v-else
        :fields="extractedInformation.target.fields"
        :occurrences="extractedInformation.target.extractions"
      />


      <span v-if="typeof extractedInformation.message === 'string'" class="text-neutral-300">
        {{ extractedInformation.message }}
      </span>
      <LogHighlighter
        v-else
        :fields="extractedInformation.message.fields"
        :occurrences="extractedInformation.message.extractions"
      />
    </div>
  </div>
</template>