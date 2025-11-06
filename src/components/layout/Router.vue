<script setup lang="ts">
import type { RouteType } from "@/types/application/route.type.ts";
import { defineAsyncComponent } from "vue";

const { page } = defineProps<{
  "page": RouteType;
}>();

const Home = defineAsyncComponent(() => import("@/pages/Home.vue"));
const Library = defineAsyncComponent(() => import("@/pages/Library.vue"));
const Settings = defineAsyncComponent(() => import("@/pages/Settings.vue"));
</script>

<template>
  <div class="relative h-full w-full shrink-0">
    <Transition name="page">
      <Home v-if="page === 'home'" />
      <Library v-else-if="page === 'library'" />
      <Settings v-else-if="page === 'settings'" />
    </Transition>
  </div>
</template>