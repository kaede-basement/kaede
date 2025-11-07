<script setup lang="ts">
const { fields, occurrences } = defineProps<{
  "fields"     : Array<string>;
  "occurrences": Array<string>;
  "colorClass"?: string;
}>();
</script>

<template>
  <span
    id="__log-highlighter__wrapper"
    v-for="(element, occurrenceIndex) in occurrences"
    :key="`${element}-${occurrenceIndex}`"
    :class="[colorClass, 'whitespace-pre']"
  >
    <span id="__log-highlighter__non-highlighted-start">
      {{ fields[occurrenceIndex] }}
    </span>
    <span id="__log-highlighter__highlighted" class="bg-indigo-600 text-[16px]">
      {{ element }}
    </span>
  </span>
  <span id="__log-highlighter__non-highlighted-end" :class="colorClass">
    {{ fields[fields.length - 1] }}
  </span>
</template>