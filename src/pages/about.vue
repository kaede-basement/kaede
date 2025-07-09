<template>
  <div>
    <h1>Current page: about.vue</h1>
    <NuxtLink to="/">Home page</NuxtLink>
    <Temporary />
    <ExampleImage additional-class="h-48" />
  </div>
</template>

<script setup lang="ts">
import Temporary from "~/components/Temporary.vue";
</script>
