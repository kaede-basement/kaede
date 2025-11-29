<script setup lang="ts">
import { computed, inject, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { InstanceStatesContextKey } from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const currentInstance = computed((): InstanceStateType | undefined => (
  Instances.findCurrent(instanceStates)
));

const status = ref<LaunchStatusType>(LaunchStatus.General.Starting);

function changeStatus(newStatus: LaunchStatusType): void {
  if (currentInstance?.value === undefined) {
    return;
  }

  log.debug(`New status for the '${currentInstance.value.id}' instance launching: '${newStatus}'`);

  status.value = newStatus;
}

async function handleLaunch(): Promise<void> {
  if (currentInstance?.value === undefined) {
    return;
  }

  await Launcher.launchWithChecks({
    "instanceId"  : currentInstance.value.id,
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