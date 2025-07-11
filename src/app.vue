<template>
  <!-- use a layout component (~/layouts/root.vue) across all pages -->
  <NuxtLayout name="root" :should-use-custom-title-bar="shouldUseCustomTitleBar">
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
import { useApplicationConfiguration, useApplicationInfo } from "~/lib/stores/app";
import initializeInstancesFiles from "~/lib/helpers/initializeInstancesFiles";
import { Effect } from "@tauri-apps/api/window";

// get Tauri's webview window
const currentWebview = getCurrentWebviewWindow();

// initialization
// "await" keyword blocks code execution until async function completes
await makeConfigsDirectory();
await initializeConfigFile();
await initializeInstancesFiles();

// get application info store
const appInfoStore = useApplicationInfo();
// get application configuration store
const configStore = useApplicationConfiguration();

// fetch app info
// fetched data will be shown in "appInfoStore"
await appInfoStore.getApplicationInfo();
// fetch app configuration
// fetched data will be shown in "configStore.data"
await configStore.getApplicationConfiguration();

// now configStore.data should have config data
const config = configStore.data;
const shouldUseCustomTitleBar = config?.customization?.customTitleBar;

// ternary operator
shouldUseCustomTitleBar
  // if custom title bar is enabled, then we need to make sure
  // that tauri hides system title bar
  ? await currentWebview.setDecorations(false)
  // by default title bar has only "Kaede" in its name
  // here we manually set it to "Kaede v{version}"
  // (only needed for system title bar, so we run it here conditionally)
  : await currentWebview.setTitle(`Kaede v${appInfoStore.version}`);

// temporarily set window effect
await currentWebview.setEffects({
  effects: [Effect.Blur],
});

// tauri doesn't wait for frontend to load and launches webview2 with flashing blank white screen.
// this is why webview window is initially not visible in the tauri.config.json, so that
// we can make it visible only when frontend is loaded
await currentWebview.show();
</script>
