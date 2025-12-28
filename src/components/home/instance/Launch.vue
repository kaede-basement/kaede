<script setup lang="ts">
import { computed, inject, ref, shallowReactive } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey, InstanceStatesContextKey } from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";
import type {
  LauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const loading = ref<boolean>(false);
const statuses: LauncherStatusesType = shallowReactive({
  "current"  : undefined,
  "downloads": new Set,
});

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

async function handleLaunch(): Promise<void> {
  if (
    currentInstance?.value === undefined ||
    currentInstance.value?.id === undefined ||
    currentInstance.value?.instance === undefined
  ) {
    log.error("The instance launch button was pressed but no instance is present");

    return;
  }

  loading.value = true;

  const startTime: number = performance.now();
  let success: boolean = false;

  statuses.current = LaunchStatus.General.Starting;
  statuses.assets.clear();
  statuses.libraries.clear();

  try {
    await Launcher.launchWithChecks({
      "instanceId": currentInstance.value.id,
      "instance"  : currentInstance.value.instance,
      statuses,
    });

    success = true;
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      `Could not launch the '${currentInstance.value.id}' instance:`,
      Errors.prettify(error),
    );
  }

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  loading.value = false;

  log.info(
    `The '${currentInstance.value.id}' launch process was done in ${totalTime} ms.`,
    `Is success: '${success}'`,
  );
}
</script>

<template>
  <div id="__temp" class="size-64 overflow-auto bg-neutral-800 text-xs">
    {{ statuses }}
  </div>
  <button
    @click="handleLaunch"
    :disabled="loading"
    id="__home-page__launch-button"
    class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:cursor-progress disabled:opacity-80"
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
