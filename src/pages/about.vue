<template>
  <div>
    <h1>Current page: about.vue</h1>
    <NuxtLink to="/">Home page</NuxtLink>
    <div class="relative w-full h-42">
      <Transition name="fade" mode="in-out">
        <Suspense>
          <Temporary />
          <template #fallback>
            Loading...
          </template>
        </Suspense>
      </Transition>
    </div>
    <ExampleImage additional-class="h-48" />
  </div>
</template>

<script setup lang="ts">
import Temporary from "~/components/Temporary.vue";
</script>
