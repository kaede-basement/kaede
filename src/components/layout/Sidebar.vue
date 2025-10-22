<script setup lang="ts">
import { ref, watchEffect } from "vue";

const count = ref<number>(0);

window.__KAEDE__.functions.shit = () => {
  count.value++;
};

watchEffect(() => {
  console.log(count.value);
});
</script>

<template>
  <div class="h-full w-20 bg-black">
  </div>
</template>
