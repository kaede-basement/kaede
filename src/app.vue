<script setup lang="ts">
import { RouterView } from "@kitbag/router";
import { ref } from "vue";
import Layout from "@/components/layout/Layout.vue";

const state = ref<string>("Hello!");
</script>

<template>
  <div>{{ state }}</div>
  <RouterView />
  <Layout />
</template>