<script setup lang="ts">
import { computed, inject, shallowReactive } from "vue";

import Image from "@/components/general/base/Image.vue";
import { ApplicationNamespace, GlobalStatesContextKey } from "@/constants/application.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const image = computed((): GlobalStatesType["layout"]["background"] => {
  const background = globalStates?.layout?.background;

  return {
    "key"  : background?.key ?? Math.random(),
    "url"  : background?.url,
    "blur" : background?.blur ?? 0,
    "color": background?.color ?? "rgb(23, 23, 23)",
  };
});

// TODO Temporary code: implement as a plugin
const previousRoute = shallowReactive<{
  "value": GlobalStatesType["pages"]["current"] | undefined;
}>({
  "value": undefined,
});

async function updateImageKey(data: GlobalStatesType["pages"]): Promise<void> {
  if (!globalStates) {
    return;
  }

  if (previousRoute.value !== data.current) {
    GlobalStateHelpers.change("layout", {
      ...globalStates.layout,
      "background": {
        ...globalStates.layout?.background,
        "key": Math.random(),
      },
    });
  }

  previousRoute.value = data.current;
}

window[ApplicationNamespace].hooks.onPagesChange.after.push(updateImageKey);
// TODO Temporary code end
</script>

<template>
  <div
    id="__router__background-wrapper"
    class="absolute bottom-0 left-0 right-0 top-0"
    :style="{
      backgroundColor: image?.color,
    }"
  >
    <Transition v-if="image?.url" name="global-background">
      <Image
        :key="image.key"
        :src="image.url"
        id="__router__background-image"
        alt="A custom layout background"
        class-names="absolute left-0 h-full w-full bg-center object-cover -z-10"
      />
    </Transition>
  </div>
</template>
