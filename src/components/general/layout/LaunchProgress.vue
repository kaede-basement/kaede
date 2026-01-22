<script setup lang="ts">
import { computed, inject } from "vue";

import {
  GlobalStatesContextKey,
  InstanceStatesContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import Instances from "@/lib/instances";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const progressLimit: number = 90;

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);
const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
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
const progress = computed<number>((oldValue: number | undefined): number => {
  if (statuses.value === undefined || statuses.value.launching === 0) {
    return 0;
  }

  if (!oldValue) {
    return statuses.value.current === LaunchStatus.General.Starting
      ? 10
      : 0;
  }

  switch (statuses.value.current) {
    case LaunchStatus.General.Starting: {
      return 10;
    }
    case LaunchStatus.PatchIndex.Success:
    case LaunchStatus.PatchMetadata.Success:
    case LaunchStatus.AssetIndex.Success:
    case LaunchStatus.AssetObjects.Success:
    case LaunchStatus.Libraries.Success:
    case LaunchStatus.Logging.Success:
    case LaunchStatus.Client.Success: {
      return Math.min(oldValue + 15, progressLimit);
    }
    case LaunchStatus.General.Success: {
      return 100;
    }
    default: {
      return oldValue;
    }
  }
});
</script>

<template>
  <div
    v-if="statuses?.downloads"
    id="__layout__launch-progress-downloads-count"
    class="absolute bottom-1 left-0 text-sm"
  >
    {{ statuses.downloads.current.size }}
    <div></div>
    {{ statuses.downloads.success }}/{{ statuses.downloads.total }}/{{ statuses.downloads.failed }}
    <div></div>
    {{ statuses.current }}
  </div>
  <div
    v-if="progress > 0"
    id="__layout__launch-progress-bar-text"
    class="absolute bottom-0 left-[-50%] z-6500 block h-1 w-full rounded-r-md bg-white transition-[transform]"
    :style="{
        transform: `scaleX(${progress * 2}%)`,
      }"
  ></div>
</template>
