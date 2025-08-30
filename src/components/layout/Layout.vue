<script setup lang="ts">
import Sidebar from "@/components/layout/Sidebar.vue";

const notShit: unknown = "lol";
const shit = notShit as () => void;

shit();
</script>

<template>
  <Sidebar />
  <slot />
</template>
