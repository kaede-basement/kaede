<script setup lang="ts">
import { computed, inject } from "vue";

import Image from "@/components/general/base/Image.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const key = computed((): string | number => {
  return globalStates?.layout?.background?.key ?? Math.random();
});
const background = computed((): string | undefined => {
  return globalStates?.layout?.background?.url;
});
</script>

<template>
  <Transition name="global-background">
    <Image
      v-if="background"
      :key="key"
      :src="background"
      id="__router__background-image"
      alt="A custom layout background"
      class-names="absolute left-0 h-full w-full bg-center object-cover -z-10"
    />
    <div
      v-else
      id="__router__background-color"
      class="absolute bottom-0 left-0 right-0 top-0 bg-neutral-900 -z-10"
    ></div>
  </Transition>
</template>
