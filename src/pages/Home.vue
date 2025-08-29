<script setup lang="ts">
import { Routes } from "@/constants/routes";
import { RouterLink } from "@kitbag/router";
import { join } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";

join("E:", "Desktop", "Kaede")
  .then(path => (
    readDir(path)
      .then(value => console.log(value))
  ));
</script>

<template>
  <div>
    Home
  </div>
  <RouterLink :to="(resolve) => resolve(Routes.About.Key)">
    Navigate to About
  </RouterLink>
</template>
