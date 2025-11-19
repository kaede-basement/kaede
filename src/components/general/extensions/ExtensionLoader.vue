<script setup lang="ts">
import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";

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
</template>