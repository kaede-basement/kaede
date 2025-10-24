<script setup lang="ts">
import type { RouteType } from "@/types/application/route.type.ts";
import { defineAsyncComponent } from "vue";
import Library from "@/pages/Library.vue";

const { page } = defineProps<{
  "page": RouteType;
}>();

const HomePage = defineAsyncComponent(() => import("@/pages/Home.vue"));
</script>

<template>
  <HomePage v-if="page === 'home'" />
  <Library v-if="page === 'library'" />
  <Library v-if="page === 'settings'" />
</template>