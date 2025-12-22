<script setup lang="ts">
import { defineAsyncComponent } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

// Do not import pages unless they are selected
const Home = defineAsyncComponent(() => import("@/components/home/Home.vue"));
const Library = defineAsyncComponent(() => import("@/components/library/Library.vue"));
const Settings = defineAsyncComponent(() => import("@/components/settings/Settings.vue"));
const AddInstance = defineAsyncComponent(() => import("@/components/add-instance/AddInstance.vue"));
const Profile = defineAsyncComponent(() => import("@/components/profile/Profile.vue"));
</script>

<template>
  <Home v-if="page === 'home'" />
  <Library v-else-if="page === 'library'" />
  <Settings v-else-if="page === 'settings'" />
  <AddInstance v-else-if="page === 'add-instance'" />
  <Profile v-else-if="page === 'profile'" />
  <!-- This block of elements is shown only when custom pages are selected -->
  <PageWrapper v-else>
    <!-- Extensions should mount their pages to this element -->
    <div id="__custom-page__wrapper"></div>
  </PageWrapper>
</template>
