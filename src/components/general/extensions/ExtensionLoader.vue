<script setup lang="ts">
import "ses";

import { onMounted } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import { GrantedScopes } from "@/constants/permissions.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

const extensionId = "Nativifier";

async function wrappedPermissionsRequest(
  permissions: Array<PermissionType>,
): Promise<Array<boolean>> {
  return await ExtensionsManager.requestPermissions(permissions, extensionId);
}

GrantedScopes[extensionId] = {
  ...GrantedScopes[extensionId],
  console,
};

lockdown();

const c = new Compartment({
  "globals": {
    "requestPermissions": wrappedPermissionsRequest,
    "GrantedScopes"     : GrantedScopes[extensionId],
  },
  "__options__": true,
});

try {
  GrantedScopes[extensionId].lol = true;
} catch (error: unknown) {
  console.error(error);
}

onMounted(async () => {
  try {
    c.evaluate(`
      (async () => {
        GrantedScopes.console.log(GrantedScopes);

        while (
          (
            await requestPermissions([
              "internet",
            ])
          )[0] === false
        ) {
          GrantedScopes.console.log("listen, i really need that access!!!");
          GrantedScopes.console.log(GrantedScopes);
        }

        GrantedScopes.console.log(GrantedScopes);
      })();
    `);
  } catch (error: unknown) {
    console.error(error);
  }
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
</template>