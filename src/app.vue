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
import { useApplicationConfiguration, useApplicationInfo } from "~/lib/stores/app";
import { Effect } from "@tauri-apps/api/window";
import makeDirectories from "~/lib/storage/makeDirectories";
import { BaseDirectory } from "@tauri-apps/api/path";

/*
 * TODO refactor
 * get Tauri's webview window
 */
const currentWebview = getCurrentWebviewWindow();

/*
 * initialization
 * "await" keyword blocks code execution until async function completes
 */
await makeDirectories({
  directories: [
    {
      baseDirectoryPath   : BaseDirectory.AppConfig,
      // do not remove empty string, otherwise it won't work
      recursiveDirectories: ["", "instances"],
    },
  ],
});
await initializeConfigFile();

// get application info store
const appInfoStore = useApplicationInfo();
// get application configuration store
const configStore = useApplicationConfiguration();

/*
 * fetch app info
 * fetched data will be shown in "appInfoStore"
 */
await appInfoStore.getApplicationInfo();

/*
 * fetch app configuration
 * fetched data will be shown in "configStore.data"
 */
await configStore.getApplicationConfiguration();

// now configStore.data should have config data
const config = configStore.data;
const shouldUseCustomTitleBar = config?.customization?.customTitleBar;

/*
 * show or hide system title bar and other window decorations
 * based on the opposite "shouldUseCustomTitleBar" value
 */
await currentWebview.setDecorations(!shouldUseCustomTitleBar);

if (shouldUseCustomTitleBar) {
  // temporarily
  await currentWebview.setEffects({
    effects: [Effect.Blur],
  });
} else {
  // temporarily
  await currentWebview.clearEffects();

  /*
   * by default title bar has only "Kaede" in its name
   * here we manually set it to "Kaede v{version}"
   * (only needed for system title bar, so we run it here conditionally)
   */
  await currentWebview.setTitle(`Kaede v${appInfoStore.version}`);
}

/*
 * tauri doesn't wait for frontend to load and launches webview2 with flashing blank white screen.
 * this is why webview window is initially not visible in the tauri.config.json, so that
 * we can make it visible only when frontend is loaded
 */
await currentWebview.show();
</script>
