<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import ExtensionAPI from "@/lib/extension-api";
import Extensions from "@/lib/extensions";
import { log } from "@/lib/logging/log.ts";
import Permissions from "@/lib/permissions";
import { permissionSession } from "@/lib/permissions/request-permissions.ts";
import Txiki from "@/lib/txiki";
import { extensionStates } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";

GlobalObject.libs.ExtensionAPI = ExtensionAPI;
GlobalObject.libs.Extensions = Extensions;
GlobalObject.libs.Permissions = Permissions;
GlobalObject.libs.Txiki = Txiki;

const endSession = Extensions.startExtensionSession();
let mounted = true;
const stopWatchingPrompt = watch(() => permissionSession.value?.prompt.value, async prompt => {
  if (prompt) {
    stopWatchingPrompt();
    await Extensions.showWebviewWindow();
  }
});

onMounted(async () => {
  try {
    const trustUpdate = Extensions.updateTrustedHashes();
    const { valid, invalid } = await Extensions.readExtensions();

    if (!mounted) {
      return;
    }

    const list = globalStates.extensions.list;
    const byHash = new Map(list.map(entry => [entry.sha256, entry]));

    for (const extension of valid) {
      if (!byHash.has(extension.artifactSha256)) {
        list.push({
          "sha256" : extension.artifactSha256,
          "enabled": false,
          "label"  : `${extension.metadata.name} (${extension.id})`,
        });
        byHash.set(extension.artifactSha256, list[list.length - 1]);
      }
    }
    extensionStates.valid = valid;
    extensionStates.invalid = invalid;

    const skipped: typeof valid = [];

    for (const type of ["unrestricted", "sandbox"]) {
      for (const extension of valid) {
        if (!mounted) {
          return;
        }
        const entry = byHash.get(extension.artifactSha256);

        if (extension.metadata.type === type && entry?.enabled) {
          const result = await Extensions.setExtensionEnabled(extension, "restore", entry);

          if (result === "policy-skipped") {
            skipped.push(extension);
          }
        }
      }
    }
    if (skipped.length > 0) {
      void trustUpdate.then(async () => {
        for (const extension of skipped) {
          if (!mounted) {
            return;
          }
          const entry = byHash.get(extension.artifactSha256);

          await Extensions.setExtensionEnabled(extension, "restore", entry);
        }
      });
    }
  } catch (error) {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to load extensions:", Errors.prettify(error));
  } finally {
    await Extensions.showWebviewWindow();
  }
});

onUnmounted(() => {
  mounted = false;
  endSession();
});
</script>

<template>
  <div
    id="__extension-loader__wrapper"
    class="max-h-[30vh] flex shrink-0 overflow-auto empty:hidden"
  ></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>
