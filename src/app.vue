<template>
  <!-- use a layout component (~/layouts/root.vue) across all pages -->
  <NuxtLayout name="root">
    <!-- file-based routing (~/pages) -->
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// reset all css styles in the tailwind style
import "@unocss/reset/tailwind.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import initializeConfigFile from "~/lib/helpers/initializeConfigFile";
import makeConfigsDirectory from "~/lib/helpers/makeConfigsDirectory";
import { useApplicationConfiguration } from "~/lib/stores/app";
import initializeInstancesFiles from "~/lib/helpers/initializeInstancesFiles";
import { BaseDirectory } from "@tauri-apps/api/path";
import makeDirectories from "~/lib/storage/makeDirectories";

// get Tauri's webview window
const currentWebview = getCurrentWebviewWindow();

// initialization
// "await" keyword blocks code execution until async function completes
await makeConfigsDirectory();
await initializeConfigFile();
await initializeInstancesFiles();
await makeDirectories({
  directories: [
    {
      baseDirectoryPath:    BaseDirectory.AppConfig,
      recursiveDirectories: ["shit", "is", "working", "perfectly", "like", "really"],
    },
  ],
});
// get application configuration store
const configStore = useApplicationConfiguration();

// fetch app configuration
// fetched data will be shown in "configStore.data"
await configStore.getApplicationConfiguration();

// now configStore.data should have config data
const config = configStore.data;

if (config?.customization?.customTitleBar) {
  // makes tauri hide system title bar
  await currentWebview.setDecorations(false);
}

// tauri doesn't wait for frontend to load and launches webview2 with flashing blank white screen.
// this is why webview window is initially not visible in the tauri.config.json, so that
// we can make it visible only when frontend is loaded
await currentWebview.show();
</script>
