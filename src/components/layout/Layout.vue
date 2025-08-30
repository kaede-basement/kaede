<script setup lang="ts">
import Sidebar from "@/components/layout/Sidebar.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import { extractError } from "@/lib/helpers/extract-error.ts";
</script>

<template>
  <div class="">
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
            Something went wrong. {{ extractError(currentError?.value).name }}: {{ extractError(currentError?.value).message }}
          </p>
          <p class="text-sm text-neutral-300 font-light break-words">
            {{ extractError(currentError?.value).stack }}
          </p>
        </div>
      </template>
    </ErrorBoundary>
  </div>
</template>
