<script setup lang="ts">
import { onMounted } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

onMounted(async () => {
  log.debug("Initializing extensions loader");
  await ExtensionsManager.initializeDirectory();

  log.debug("Getting all stored extensions");
  const extensions: Array<ExtensionInfoType> = await ExtensionsManager.readAllExtensions();

  log.debug("Getting extensions metadata file");
  const metadata: Array<ExtensionMetadataType> = await ExtensionsManager.readAllMetadata();

  log.debug("Locking down the JavaScript environment");
  ExtensionsManager.lockdownEnvironment();
  log.info("The JavaScript environment was locked down");

  console.log(extensions);
});

/*
 * Module Federation
 *
 * import { createInstance } from "@module-federation/enhanced/runtime";
 * import { defineAsyncComponent } from "vue";
 *
 * const mf = createInstance({
 *   "name"   : "mf_host",
 *   "remotes": [],
 * });
 *
 * mf.registerRemotes([
 *   {
 *     "name" : "remote1",
 *     "alias": "remote-1",
 *     "entry": "http://localhost:4173/bundle.js",
 *     // "entry": "https://unpkg.com/module-federation-rslib-provider@latest/dist/mf/mf-manifest.json",
 *   },
 * ]);
 *
 * const Huh = defineAsyncComponent(async () => {
 *   let element: { "MyButton": unknown } = { "MyButton": () => "<div></div>" };
 *
 *   try {
 *     element = await mf.loadRemote("remote1") as { "MyButton": unknown };
 *   } catch {
 *     // | console.log("Error loading Remote");
 *   }
 *
 *   return {
 *     "default": element.MyButton,
 *   };
 * });
 */
</script>

<template>
  <div id="__extension-loader__wrapper"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>