<script setup lang="ts">
import { defineAsyncComponent } from "vue";

import Image from "@/components/general/base/Image.vue";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

const __urls: Record<string, string> = {
  "home"        : "https://motionbgs.com/media/2787/morizuki-suzumi-blue-archive.jpg",
  "library"     : "https://moewalls.com/wp-content/uploads/2023/01/arona-stargazing-blue-archive-thumb.jpg",
  "settings"    : "https://i.redd.it/5e6h5ml67x961.jpg",
  "add-instance": "https://i.pinimg.com/736x/c2/1d/a7/c21da7189d927e4727e5697c22005f3a.jpg",
  "profile"     : "https://motionbgs.com/media/2787/morizuki-suzumi-blue-archive.jpg",
};

const Home = defineAsyncComponent(() => import("@/components/home/Home.vue"));
const Library = defineAsyncComponent(() => import("@/components/library/Library.vue"));
const Settings = defineAsyncComponent(() => import("@/components/settings/Settings.vue"));
const AddInstance = defineAsyncComponent(() => import("@/components/add-instance/AddInstance.vue"));
const Profile = defineAsyncComponent(() => import("@/components/profile/Profile.vue"));
</script>

<template>
  <div id="__router__wrapper" class="relative h-full w-full bg-[theme(colors.black/.75)]">
    <Transition name="global-background">
      <Image
        :key="__urls[page]"
        :src="__urls[page]"
        id="__router__background"
        alt="Shiroko"
        class-names="absolute left-0 h-full w-full bg-center object-cover -z-10"
      />
    </Transition>
    <Transition name="page">
      <Home v-if="page === 'home'" />
      <Library v-else-if="page === 'library'" />
      <Settings v-else-if="page === 'settings'" />
      <AddInstance v-else-if="page === 'add-instance'" />
      <Profile v-else-if="page === 'profile'" />
    </Transition>
  </div>
</template>