<script setup lang="ts">
import { computed, inject, ref } from "vue";

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
import { useIntervalFn } from "@vueuse/core";

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

  switch (statuses.value.current) {
    case LaunchStatus.Metadata.ReadingCachedVersionMeta: {
      return Math.min(oldValue + 2, progressLimit);
    }
    case LaunchStatus.Metadata.ValidatingVersionMeta: {
      return Math.min(oldValue + 4, progressLimit);
    }
    case LaunchStatus.Assets.ReadingCachedMeta: {
      return Math.min(oldValue + 2, progressLimit);
    }
    case LaunchStatus.Logging.DownloadingConfig: {
      return Math.min(oldValue + 2, progressLimit);
    }
    case LaunchStatus.Client.DownloadingJar: {
      return Math.min(oldValue + 2, progressLimit);
    }
    case LaunchStatus.Assets.Done: {
      return Math.min(oldValue + 12, progressLimit);
    }
    case LaunchStatus.Client.Done: {
      return Math.min(oldValue + 12, progressLimit);
    }
    case LaunchStatus.Logging.Done: {
      return Math.min(oldValue + 12, progressLimit);
    }
    case LaunchStatus.Libraries.Done: {
      return Math.min(oldValue + 12, progressLimit);
    }
    case LaunchStatus.Patches.Done: {
      return Math.min(oldValue + 12, progressLimit);
    }
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

  downloadsAmount.value = statuses.value.downloads.size;
}, 50);
</script>

<template>
  <div id="__home-page__launch-progress-bar-downloads" class="text-sm">
    Downloads: {{ downloadsAmount }}
  </div>
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
