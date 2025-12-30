<script setup lang="ts">
import { computed, inject } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey, InstanceStatesContextKey } from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

async function __changeName(): Promise<void> {
  if (!currentInstance.value || !globalStates || !instanceStates) {
    return;
  }

  const instanceKeys = Object.keys(instanceStates);

  if (instanceKeys.length === 1) {
    return;
  }

  const randomIndex = Math.floor(
    Math.random() * instanceKeys.length,
  );
  const newKey = instanceKeys[randomIndex];

  if (newKey === currentInstance.value.id) {
    const safeIndex = (randomIndex - 1) < 0
      ? 1
      : ((randomIndex + 1) >= instanceKeys.length
        ? 0
        : randomIndex + 1);
    const differentKey = instanceKeys[safeIndex];

    GlobalStateHelpers.change("layout", {
      ...globalStates.layout,
      "currentInstance": differentKey,
    });

    return;
  }

  GlobalStateHelpers.change("layout", {
    ...globalStates.layout,
    "currentInstance": newKey,
  });
}
</script>

<template>
  <button
    v-if="currentInstance"
    @click="__changeName"
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color,opacity] hover:bg-[theme(colors.neutral.100/.05)]"
  >
    <Image
      id="__home-page__current-instance-logo"
      class-names="rounded-md size-12 p-1"
      :src="currentInstance.instance.icon"
      :alt="`${currentInstance.instance.name}'s icon`"
    />
    <span
      id="__home-page__current-instance-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-instance-information-title"
        class="block font-medium"
      >
        {{ currentInstance.instance.name }}
      </span>
      <span
        id="__home-page__current-instance-information-version"
        class="block text-neutral-400"
      >
        {{ currentInstance.instance.version }}
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>
