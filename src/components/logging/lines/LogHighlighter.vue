<script setup lang="ts">
const { fields, occurrences, index, colorClass } = defineProps<{
  "fields"     : Array<string>;
  "occurrences": Array<string>;
  "index"      : number;
  "colorClass"?: string;
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
    <span :id="`__log-highlighter__highlighted-${index}`" class="bg-pink-700">
      {{ element }}
    </span>
  </span>
  <span :id="`__log-highlighter__non-highlighted-end-${index}`" :class="colorClass">
    {{ fields[fields.length - 1] }}
  </span>
</template>