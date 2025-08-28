<script setup lang="ts">
import { Routes } from "@/constants/routes";
import { RouterLink } from "@kitbag/router";

</script>

<template>
  <div>
    About
  </div>
  <RouterLink
    replace
    :to="(resolve) => resolve(Routes.Home.Key)"
  >
    Navigate to Home
  </RouterLink>
</template>
