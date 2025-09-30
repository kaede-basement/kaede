<script setup lang="ts">
import { ref } from "vue";

const count = ref<number>(0);

window.__KAEDE__.functions.shit = () => {
  count.value++;
};
</script>

<template>
  <div>
    {{ count }}
  </div>
</template>
