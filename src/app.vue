<template>
  <!-- use a layout component (~/layouts/root.vue) across all pages -->
  <NuxtLayout name="root">
    <!-- file-based routing (~/pages) -->
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// reset all css styles
import "@unocss/reset/tailwind.css";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// get Tauri's webview window
const currentWebview = getCurrentWebviewWindow();

//
await currentWebview.setDecorations(true);

// tauri doesn't wait for frontend to load and launches webview2 with flashing blank white screen.
// this is why webview window is initially not visible in the tauri.config.json, so that
// we can make it visible only when frontend is loaded
await currentWebview.show();
</script>
