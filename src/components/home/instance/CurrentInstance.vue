<script setup lang="ts">
import { computed, inject, ref } from "vue";

import Dropdown from "@/components/general/base/Dropdown.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey, InstanceStatesContextKey } from "@/constants/application.ts";
import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type { DropdownItemType } from "@/types/application/dropdown-item.type.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);
const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const selector = ref<boolean>(false);
const syncing = ref<boolean>(false);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.layout?.currentInstance, instanceStates)
));

function openInstancesSelector(): void {
  selector.value = true;
}
function closeInstancesSelector(): void {
  selector.value = false;
}

async function selectInstance(id: string, layout: GlobalStatesType["layout"]): Promise<void> {
  syncing.value = true;

  try {
    GlobalStateHelpers.change("layout", {
      ...layout,
      "currentInstance": id,
    });
    closeInstancesSelector();

    await Configs.sync();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not select the instance:",
      Errors.prettify(error),
    );
  }

  syncing.value = false;
}

const dropdown = computed((): Array<DropdownItemType> => {
  if (instanceStates === undefined || globalStates === undefined) {
    return [];
  }

  const instances: Array<[string, InstanceStateType]> = Object.entries(instanceStates);
  const currentId: string | undefined = currentInstance.value?.id;

  return instances.map(([id, instance]) => {
    return {
      "id"      : `__home-page__current-instance-${id}`,
      "image"   : instance.icon,
      "onclick" : (): Promise<void> => selectInstance(id, globalStates.layout),
      "title"   : instance.name,
      "subtitle": instance.version,
      "disabled": id === currentId,
    };
  });
});
</script>

<template>
  <Dropdown
    id="__home-page__current-instance-dropdown"
    add-class-names="absolute bottom-16 z-50"
    size-class-names="h-85 w-full"
    :shown="selector"
    :close="closeInstancesSelector"
    :items="dropdown"
  />
  <button
    v-if="currentInstance"
    :disabled="syncing"
    @mousedown="openInstancesSelector"
    @click="openInstancesSelector"
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color,opacity] active:cursor-default hover:bg-[theme(colors.neutral.100/.05)]"
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
