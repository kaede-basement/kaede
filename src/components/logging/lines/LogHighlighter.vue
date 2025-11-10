<script setup lang="ts">
const { fields, occurrences, index, colorClass, searchPosition } = defineProps<{
  "fields"         : Array<string>;
  "occurrences"    : Array<string>;
  "index"          : number;
  "searchPosition"?: number | undefined;
  "colorClass"    ?: string;
}>();
</script>

<template>
  <span
    :id="`__log-highlighter__wrapper-${index}`"
    v-for="(element, occurrenceIndex) in occurrences"
    :key="`${element}-${occurrenceIndex}`"
    :class="[colorClass, 'whitespace-pre']"
  >
    <span :id="`__log-highlighter__non-highlighted-start-${index}`">
      {{ fields[occurrenceIndex] }}
    </span>
    <span
      :id="`__log-highlighter__highlighted-${index}`"
      :class="[
        searchPosition === index ? 'bg-pink-600 text-white' : 'bg-purple-400 text-black'
      ]"
    >
      {{ element }}
    </span>
  </span>
  <span :id="`__log-highlighter__non-highlighted-end-${index}`" :class="colorClass">
    {{ fields[fields.length - 1] }}
  </span>
</template>