<script setup lang="ts">
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { LaunchStatus } from "@/constants/launcher.ts";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/scopes/log.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

const status = ref<LaunchStatusType>(LaunchStatus.GettingStarted);
const _temporary = "vanilla-1.16.5";

function changeStatus(newStatus: LaunchStatusType): void {
  log.debug(`New status for the '${_temporary}' instance launching:`, newStatus);

  status.value = newStatus;
}

async function handleLaunch(): Promise<void> {
  await Launcher.launchWithChecks({
    "instanceId"  : _temporary,
    "changeStatus": changeStatus,
  });
}
</script>

<template>
  {{ status }}
  <button
    @click="handleLaunch"
    id="__home-page__launch-button"
    class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Launch
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
</template>