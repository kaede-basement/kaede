<template>
  <NuxtLoadingIndicator />
  <NuxtLayout name="root">
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// reset all css styles
import "@unocss/reset/tailwind.css";
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
