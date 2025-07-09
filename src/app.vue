<template>
  <NuxtLayout name="root">
    {{ configurationFilePath }}
  </NuxtLayout>
</template>

<script setup lang="ts">
import { join, appConfigDir } from "@tauri-apps/api/path";
import { sendNotification } from "@tauri-apps/plugin-notification";
import {  } from "@tauri-apps/plugin-cli";

const appConfigDirectoryPath = await appConfigDir();
const configurationFilePath = await join(appConfigDirectoryPath, "config.json5");

sendNotification({
    title: "Kaede",
    body:  "sosal?",
});
</script>
