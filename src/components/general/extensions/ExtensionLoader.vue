<script setup lang="ts">
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { inject, onMounted, ref } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtensionInfoType } from "@/types/extensions/extension-info.type.ts";
import type { ExtensionMetadataType } from "@/types/extensions/extension-metadata.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const knownExtensions = ref<Array<ExtensionMetadataType>>([]);
const unknownExtensions = ref<Array<ExtensionInfoType>>([]);

onMounted(async () => {
  log.debug("Initializing extensions loader");
  await ExtensionsManager.initializeDirectory();

  log.debug("Getting all stored extensions");
  const extensions: Array<ExtensionInfoType> = await ExtensionsManager.readAllExtensions();

  log.debug("Getting extensions metadata file");
  const metadataList: Array<ExtensionMetadataType> = await ExtensionsManager.readAllMetadata();

  knownExtensions.value = metadataList;

  log.debug("Mapping valid and known extensions metadata");
  const metadataMap = new Map<string, {
    "type"   : ExtensionMetadataType["type"];
    "enabled": ExtensionMetadataType["enabled"];
  } | undefined>;

  for (const { id, type, enabled } of metadataList) {
    metadataMap.set(id, { type, enabled });
  }

  const toExecute: Record<
    ExtensionMetadataType["type"],
    Array<ExtensionInfoType>
  > = { "sandbox": [], "unrestricted": [] };

  log.debug("Validating stored extensions against known extensions map");
  for (const extension of extensions) {
    const mappedMetadata = metadataMap.get(extension.id);

    if (mappedMetadata === undefined) {
      unknownExtensions.value.push(extension);

      continue;
    }

    if (mappedMetadata.enabled === true) {
      toExecute[mappedMetadata.type].push(extension);
    }
  }

  log.debug("Initializing all enabled unrestricted extensions");
  for (const { id, code } of toExecute.unrestricted) {
    ExtensionsManager.runInUnrestricted(id, code);
  }

  const hasSandboxedPlugins = toExecute.sandbox.length > 0;

  if (!hasSandboxedPlugins) {
    log.debug("User does not have sandboxed plugins. Environment lockdown is not needed");

    if (globalStates?.misc?.showAfterExtensionsInitialization) {
      log.debug(
        "User has enabled 'show-after-extensions-initialization';",
        "Showing the webview now",
      );
      await getCurrentWebviewWindow().show();
    }

    return;
  }

  log.debug("Locking down the JavaScript environment");
  ExtensionsManager.lockdownEnvironment();
  log.info("The JavaScript environment was locked down");

  log.debug("Initializing all enabled sandboxed extensions");
  for (const { id, code } of toExecute.sandbox) {
    ExtensionsManager.runInSandbox({
      id,
      code,
      // TODO handle permissions
      "globals": {},
    });
  }

  if (globalStates?.misc?.showAfterExtensionsInitialization) {
    log.debug(
      "User has enabled 'show-after-extensions-initialization';",
      "Showing the webview now",
    );
    await getCurrentWebviewWindow().show();
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

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>