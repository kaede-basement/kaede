<script setup lang="ts">
import { defineAsyncComponent } from "vue";

import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

const Home = defineAsyncComponent(() => import("@/components/home/Home.vue"));
const Library = defineAsyncComponent(() => import("@/components/library/Library.vue"));
const Settings = defineAsyncComponent(() => import("@/components/settings/Settings.vue"));
const AddInstance = defineAsyncComponent(() => import("@/components/add-instance/AddInstance.vue"));
</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full">
    <Transition name="page">
      <Home v-if="page === 'home'" />
      <Library v-else-if="page === 'library'" />
      <Settings v-else-if="page === 'settings'" />
      <AddInstance v-else-if="page === 'add-instance'" />
    </Transition>
  </div>
</template>