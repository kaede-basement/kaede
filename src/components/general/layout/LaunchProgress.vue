<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, inject, ref } from "vue";

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

const progressLimit: number = 88;

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);
const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);

const downloadsAmount = ref<number>(0);

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
      ? 4
      : 0;
  }

  console.log(progressLimit);

  switch (statuses.value.current) {
    /*
     * | case LaunchStatus.Metadata.ReadingCachedVersionMeta: {
     *       return Math.min(oldValue + 2, progressLimit);
     *     }
     *     case LaunchStatus.Metadata.ValidatingVersionMeta: {
     *       return Math.min(oldValue + 4, progressLimit);
     *     }
     *     case LaunchStatus.Assets.ReadingCachedMeta: {
     *       return Math.min(oldValue + 2, progressLimit);
     *     }
     *     case LaunchStatus.Logging.DownloadingConfig: {
     *       return Math.min(oldValue + 2, progressLimit);
     *     }
     *     case LaunchStatus.Client.DownloadingJar: {
     *       return Math.min(oldValue + 2, progressLimit);
     *     }
     *     case LaunchStatus.Assets.Done: {
     *       return Math.min(oldValue + 12, progressLimit);
     *     }
     *     case LaunchStatus.Client.Done: {
     *       return Math.min(oldValue + 12, progressLimit);
     *     }
     *     case LaunchStatus.Logging.Done: {
     *       return Math.min(oldValue + 12, progressLimit);
     *     }
     *     case LaunchStatus.Libraries.Done: {
     *       return Math.min(oldValue + 12, progressLimit);
     *     }
     *     case LaunchStatus.Patches.Done: {
     *       return Math.min(oldValue + 12, progressLimit);
     *     }
     */
    case LaunchStatus.General.Success: {
      return 100;
    }
    default: {
      return oldValue;
    }
  }
});

useIntervalFn(() => {
  if (statuses.value === undefined) {
    return;
  }

  downloadsAmount.value = statuses.value.downloads.total;
}, 50);
</script>

<template>
  <div
    v-if="progress > 0"
    id="__layout__launch-progress-bar-text"
    class="absolute bottom-0 left-[-50%] z-6500 block h-1 w-full rounded-r-md bg-white transition-[transform]"
    :style="{
        transform: `scaleX(${progress * 2}%)`,
      }"
  ></div>
</template>
