<script setup lang="ts">
import { Routes } from "@/constants/routes";
import { RouterLink } from "@kitbag/router";
</script>

<template>
  <div>
    Home
  </div>
  <RouterLink :to="(resolve) => resolve(Routes.About.Key)">
    Navigate to About
  </RouterLink>
</template>
