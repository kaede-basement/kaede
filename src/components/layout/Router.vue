<script setup lang="ts">
import type { RouteType } from "@/types/application/route.type.ts";
import { defineAsyncComponent } from "vue";

const { page } = defineProps<{
  "page": RouteType;
}>();

const Home = defineAsyncComponent(() => import("@/pages/Home.vue"));
const Library = defineAsyncComponent(() => import("@/pages/Library.vue"));
</script>

<template>
  <Home v-if="page === 'home'" />
  <Library v-if="page === 'library'" />
  <Library v-if="page === 'settings'" />
</template>