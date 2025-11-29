<script setup lang="ts">
import { computed, inject } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { InstanceStatesContextKey } from "@/constants/application.ts";
import Instances from "@/lib/instances";
import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";

const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const currentInstance = computed((): InstanceStateType | undefined => (
  Instances.findCurrent(instanceStates)
));
</script>

<template>
  <button
    v-if="currentInstance"
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2"
  >
    <Image
      id="__home-page__current-instance-logo"
      class-names="rounded-md size-12 p-1"
      :src="currentInstance.icon"
      :alt="`${currentInstance.name}'s icon`"
    />
    <span
      id="__home-page__current-instance-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-instance-information-title"
        class="block font-medium"
      >
        {{ currentInstance.name }}
      </span>
      <span
        id="__home-page__current-instance-information-version"
        class="block text-neutral-400"
      >
        {{ currentInstance.version }}
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>