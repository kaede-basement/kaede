<script setup lang="ts">
import { computed, inject } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey, InstanceStatesContextKey } from "@/constants/application.ts";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/current-instance.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch-status.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

const statuses: LauncherStatusesType = new Set;

async function handleLaunch(): Promise<void> {
  if (currentInstance?.value === undefined) {
    return;
  }

  statuses.clear();
  await Launcher.launchWithChecks({
    "instanceId": currentInstance.value.id,
    statuses,
  });

  console.log(statuses);
}
</script>

<template>
  <div id="__temp" class="size-64 overflow-auto bg-neutral-800 text-xs">
    {{ statuses }}
  </div>
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
