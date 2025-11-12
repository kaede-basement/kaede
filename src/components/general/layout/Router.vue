<script setup lang="ts">
import { defineAsyncComponent } from "vue";

import GlobalBackground from "@/components/general/layout/GlobalBackground.vue";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

const Home = defineAsyncComponent(() => import("@/components/home/Home.vue"));
const Library = defineAsyncComponent(() => import("@/components/library/Library.vue"));
const Settings = defineAsyncComponent(() => import("@/components/settings/Settings.vue"));
const AddInstance = defineAsyncComponent(() => import("@/components/add-instance/AddInstance.vue"));
const Profile = defineAsyncComponent(() => import("@/components/profile/Profile.vue"));
</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full">
    <GlobalBackground />
    <Transition name="page">
      <Home v-if="page === 'home'" />
      <Library v-else-if="page === 'library'" />
      <Settings v-else-if="page === 'settings'" />
      <AddInstance v-else-if="page === 'add-instance'" />
      <Profile v-else-if="page === 'profile'" />
    </Transition>
  </div>
</template>
