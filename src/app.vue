<template>
  <NuxtLoadingIndicator />
  <NuxtLayout name="root">
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
import "@unocss/reset/tailwind.css";
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: all cubic-bezier(0.4, 0, 1, 1) 150ms;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: scale3d(0.98, 0.98, 1);
}
</style>
