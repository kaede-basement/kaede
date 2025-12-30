<script setup lang="ts">
import { computed, inject } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
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
  if (statuses.value === undefined) {
    return 0;
  }

  if (statuses.value.launching === 0) {
    return 0;
  }

  switch (statuses.value.current) {
    case LaunchStatus.General.Starting: {
      return 4;
    }
    case LaunchStatus.Metadata.ReadingCachedVersionMeta: {
      return 6;
    }
    case LaunchStatus.Metadata.FetchingVersionMeta: {
      return 8;
    }
    case LaunchStatus.Metadata.ValidatingVersionMeta: {
      return 20;
    }
    case LaunchStatus.Assets.ReadingCachedMeta: {
      return 22;
    }
    case LaunchStatus.Assets.FetchingMeta: {
      return 24;
    }
    case LaunchStatus.Logging.DownloadingConfig: {
      return 30;
    }
    case LaunchStatus.Client.DownloadingJar: {
      return 25;
    }
    case LaunchStatus.Logging.Done: {
      return 30;
    }
    case LaunchStatus.Client.Done: {
      return 40;
    }
    case LaunchStatus.Libraries.Done: {
      return 50;
    }
    case LaunchStatus.Patches.Done: {
      return 70;
    }
    case LaunchStatus.Assets.Done: {
      return 90;
    }
    case LaunchStatus.General.Success: {
      return 100;
    }
    default: {
      return oldValue ?? 0;
    }
  }
});
</script>

<template>
  <button
    v-if="progress > 0"
    @click="() => {}"
    id="__home-page__launch-progress-bar-button"
    class="relative w-full rounded-md bg-white p-1 transition-[background-color] hover:bg-[theme(colors.neutral.100/.85)]"
  >
    <span
      id="__home-page__launch-progress-bar-text"
      class="block h-[6px] rounded-md bg-neutral-800 transition-[width]"
      :style="{
        width: progress + '%',
      }"
    ></span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
</template>
