<template>
  <div class="flex flex-col gap-0 rounded-b-md overflow-clip">
    <!-- for accessibility, to announce page navigation for screen readers -->
    <NuxtRouteAnnouncer />
    <!-- show loading bar at the top of the page -->
    <NuxtLoadingIndicator />
    <Titlebar v-if="shouldUseCustomTitleBar" />
    <div :class="[adaptedHeight, 'flex w-full bg-black bg-opacity-75 text-white']">
      <Sidebar />
      <div class="flex overflow-hidden w-full">
        <div
class="w-full
            overflow-auto
            [&::-webkit-scrollbar]:w-3
            [&::-webkit-scrollbar-track]:rounded-full
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:transition
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-[#6F7279]
            [&::-webkit-scrollbar-thumb:hover]:bg-[#5C5F66]
            ![&::-webkit-scrollbar-thumb:active]:bg-[#3A3D45]
        ">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sidebar from "~/components/layout/Sidebar.vue";
import Titlebar from "~/components/layout/Titlebar.vue";

// use passed "shouldUseCustomTitleBar" prop from NuxtLayout
const layoutProperties = useAttrs();
const shouldUseCustomTitleBar = layoutProperties["should-use-custom-title-bar"];
const adaptedHeight = shouldUseCustomTitleBar ? "h-[calc(100vh-32px)]" : "h-[100vh]";

// assign a "__nuxt-body" class to <body />
useHead({
  "bodyAttrs": {
    "class": "__nuxt-body",
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
