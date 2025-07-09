<template>
  <NuxtLayout name="root">
    {{ configurationFilePath }}
  </NuxtLayout>
</template>

<script setup lang="ts">
import { join, appConfigDir } from "@tauri-apps/api/path";

const appConfigDirectoryPath = await appConfigDir();
const configurationFilePath = await join(appConfigDirectoryPath, "config.json5");
</script>
