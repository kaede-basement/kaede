<script setup lang="ts">
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { useIntervalFn } from "@vueuse/core";
import { ref } from "vue";

import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

const syncing = ref<boolean>(false);

async function handleConfigSync(): Promise<void> {
  const t1 = performance.now();

  syncing.value = true;

  log.debug("Getting current global states");
  const currentGlobalStates = GlobalStateHelpers.get();
  const configPath = currentGlobalStates.fileSystem?.files?.config;

  if (!configPath)  {
    log.warn("No config path was found in global states. Aborting config sync");
    syncing.value = false;

    return;
  }

  log.debug("Getting current user config");
  const config = await Configs.getSafe();

  log.debug("Creating a 'ConfigType' typed object with the global states contents");
  const configOnlyGlobalStates: ConfigType = {
    // Arrange these properties in a way that the config itself arranges them
    "development": currentGlobalStates.development,
    "layout"     : currentGlobalStates.layout,
    "logs"       : {
      ...currentGlobalStates.logs,
      "show": false,
    },
    "minecraft": currentGlobalStates.minecraft,
    "misc"     : currentGlobalStates.misc,
  };
  const stringyConfig = JSON.stringify(config);
  const stringyGlobalStates = JSON.stringify(configOnlyGlobalStates);

  if (stringyConfig === stringyGlobalStates) {
    log.info("Seems like config didn't change. No need for config sync");
    syncing.value = false;

    return;
  }

  try {
    log.debug("Updating the config file with new values");
    await writeTextFile(
      configPath,
      JSON.stringify(configOnlyGlobalStates, null, 2),
    );
  } catch (error: unknown) {
    log.error("Failed to sync the config file:", Errors.prettify(error));
  }

  log.info(
    "Config file successfully synced in:",
    (performance.now() - t1).toFixed(1),
    "ms",
  );
  syncing.value = false;
}

// Trigger config sync every 30 seconds
useIntervalFn(handleConfigSync, 30_000);
</script>

<template>
  <div
    id="__config-syncer__wrapper"
    :class="[
      syncing ? 'opacity-20' : 'opacity-0 transition-[opacity]',
      'fixed bottom-6 left-6 pointer-events-none z-5000',
    ]"
  >
    <div
      id="__config-syncer__loader-icon"
      class="i-lucide-cog size-8"
    ></div>
  </div>
</template>
