<script setup lang="ts">
const { fields, occurrences } = defineProps<{
  "fields"     : Array<string>;
  "occurrences": Array<string>;
}>();
</script>

<template>
  <span
    v-for="(element, occurrenceIndex) in occurrences"
    :key="`${element}-${occurrenceIndex}`"
  >
    <span>{{ fields[occurrenceIndex] }}</span>
    <span class="bg-indigo-600 text-[16px]">{{ element }}</span>
  </span>
  <span>
    {{ fields[fields.length - 1] }}
  </span>
</template>