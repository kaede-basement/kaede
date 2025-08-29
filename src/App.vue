<script setup lang="ts">
import { RouterView } from "@kitbag/router";
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
</script>

<template>
  <ErrorBoundary>
    <Layout>
      <RouterView />
    </Layout>

    <template #error="{ currentError }">
      <div>
        <p>
          {{ JSON.stringify(currentError) }}</p>
      </div>
    </template>
  </ErrorBoundary>
</template>
