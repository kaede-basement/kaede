<script setup lang="ts">
import { computed, inject, ref, watchEffect } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  CloseInstanceContextKey,
  GlobalStatesContextKey,
  InstanceStatesContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const killing = ref<boolean>(false);

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);
const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);
const launchInstance = inject<(instanceId?: string) => Promise<void>>(
  LaunchInstanceContextKey,
);
const closeInstance = inject<(instanceId: string) => Promise<void>>(
  CloseInstanceContextKey,
);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));
const statuses = computed((): LauncherStatusesType | undefined => {
  const instanceId: string | undefined = currentInstance?.value?.id;

  if (
    instanceId === undefined ||
    instanceStatuses === undefined
  ) {
    return undefined;
  }

  return instanceStatuses[instanceId];
});

function handleLaunch(): void {
  if (launchInstance === undefined) {
    log.error("The injected 'launchInstance' function is undefined. What happened lol");

    return;
  }

  launchInstance(currentInstance?.value?.id);
}
async function handleClose(): Promise<void> {
  if (closeInstance === undefined) {
    log.error("The injected 'closeInstance' function is undefined. What happened lol");

    return;
  }

  const instanceId: string | undefined = currentInstance?.value?.id;

  if (instanceId === undefined) {
    log.error("The current instance id is undefined");

    return;
  }

  try {
    killing.value = true;
    await closeInstance(instanceId);
  } catch (error: unknown) {
    log.error("Could not close the instance process:", Errors.prettify(error));
  }

  killing.value = false;
}

watchEffect((): void => {
  const launchingInstance: boolean = statuses.value?.launching === 1;
  const killingInstance: boolean = killing.value;

  document.body.style.cursor = (launchingInstance || killingInstance)
    ? "progress"
    : "";
});
</script>

<template>
  <button
    @click="handleLaunch"
    :disabled="statuses?.launching === 1 || statuses?.launching === 2"
    id="__home-page__launch-button"
    class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-80"
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
  <button
    v-if="statuses?.launching === 2"
    @click="handleClose"
    id="__home-page__launch-abort-button"
    :disabled="killing"
    class="relative w-fit rounded-sm bg-white px-1 py-2 text-black transition-[opacity] disabled:opacity-80"
  >
    <span
      id="__home-page__launch-abort-icon"
      class="i-lucide-x block"
    ></span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
</template>
