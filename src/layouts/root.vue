<template>
  <!-- for accessibility, to announce page navigation for screen readers -->
  <NuxtRouteAnnouncer />
  <!-- show loading bar at the top of the page -->
  <NuxtLoadingIndicator />
  <div class="flex w-full h-[100vh] bg-white bg-opacity-80">
    <Sidebar />
    <div class="flex overflow-clip w-full">
      <div class="w-full overflow-auto [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:transition [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#6F7279] [&::-webkit-scrollbar-thumb:hover]:bg-[#5C5F66] ![&::-webkit-scrollbar-thumb:active]:bg-[#3A3D45]">
        <slot />
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// assign a "__nuxt-body" class to <body />
import Sidebar from "~/components/layout/Sidebar.vue";

useHead({
  bodyAttrs: {
    class: "__nuxt-body",
  },
});
</script>

<style>
/* apply transitions for opacity */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 100ms ease;
}

/* initial state for entering, and final state for leaving */
.fade-enter-from,
.fade-leave-to {
  opacity: 0; /* start with opacity 0 (invisible) */
}

/* html document's <body /> element */
.__nuxt-body {
	margin: 0;
	padding: 0;
  font-family: Geist, Roboto, sans-serif;
}
</style>
