<script setup lang="ts">
import Sidebar from "@/components/layout/Sidebar.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
</script>

<template>
  <div class="flex flex-nowrap gap-0">
    <div id="__kaede-extensions" class="block" />
    <Sidebar />
    <!-- Pages error boundary -->
    <ErrorBoundary>
      <template #default>
        <slot />
      </template>

      <!-- In case of an error, show this template -->
      <template #error="{ currentError }">
        <div class="h-full w-full flex flex-col select-text gap-4 bg-black p-8 text-white">
          <p class="text-xl font-light">
            Something went wrong. {{ currentError?.value?.name }}: {{ currentError?.value?.message }}
          </p>
          <p class="break-words text-sm text-neutral-300 font-light">
            {{ currentError?.value?.stack }}
          </p>
        </div>
      </template>
    </ErrorBoundary>
  </div>
</template>
