<script setup lang="ts">
import { RouterView } from "@kitbag/router";
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
</script>

<template>
  <ErrorBoundary>
    <template #default>
      <Layout>
        <RouterView />
      </Layout>
    </template>

    <!-- In case of a global error, show this template -->
    <template #error="{ currentError }">
      <div>
        <p>
          Uhm: {{ JSON.stringify(currentError?.value) }}</p>
      </div>
    </template>
  </ErrorBoundary>
</template>
