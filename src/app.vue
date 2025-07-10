<template>
  <!-- Use a layout component (~/layouts/root.vue) across all pages -->
  <NuxtLayout name="root">
    <!-- Routing goes here. Create a new file in ~/pages/ to make a route -->
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// reset all css styles
import "@unocss/reset/tailwind.css";
</script>
