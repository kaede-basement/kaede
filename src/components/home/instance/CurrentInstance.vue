<script setup lang="ts">
import { computed, inject, ref } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey, InstanceStatesContextKey } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/current-instance.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

const disabled = ref<boolean>(false);

async function __changeName(): Promise<void> {
  if (!currentInstance.value) {
    return;
  }

  disabled.value = true;

  try {
    const id = currentInstance.value.id;
    const instance = currentInstance.value.instance;

    Instances.change(id, {
      ...instance,
      "name": `Vanilla 1.${Math.floor(Math.random() * 21)}`,
    });

    if (!instanceStates) {
      return;
    }

    await Instances.syncMetadata(instanceStates);
  } catch (error: unknown) {
    log.error("Could not change the current instance name:", Errors.prettify(error));
  }

  disabled.value = false;
}
</script>

<template>
  <button
    v-if="currentInstance"
    @click="__changeName"
    :disabled="disabled"
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[opacity] disabled:cursor-default disabled:opacity-50"
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