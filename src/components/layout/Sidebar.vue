<template>
  <div />
  <p>{{ store.name }}</p>
  <p>{{ store.version }}</p>
</template>

<script setup lang="ts">
import { useApplicationInfo } from "@/lib/stores/app";

const store = useApplicationInfo();

store.getApplicationInfo();
</script>
