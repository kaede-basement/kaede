<script setup lang="ts">
import { computed } from "vue";

import Image from "@/components/general/base/Image.vue";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { DeepNonNullable } from "@/types/utils/deep-non-nullable.type.ts";

const image = computed((): DeepNonNullable<GlobalStatesType["layout"]["background"]> => {
  const background = globalStates?.layout?.background;

  return {
    "key"    : background?.key ?? background?.url ?? "",
    "url"    : background?.url ?? "",
    "blur"   : background?.blur ?? 0,
    "color"  : background?.color ?? "rgba(28, 28, 28, 0.6)",
    "isVideo": background?.isVideo ?? false,
  };
});
</script>

<template>
  <div
    id="__router__background-wrapper"
    class="absolute bottom-0 left-0 right-0 top-0"
    :style="{
      backgroundColor: image.color,
    }"
  >
    <div
      v-if="image.blur !== 0"
      id="__router__background-blur"
      class="absolute bottom-0 left-0 right-0 top-0"
      :style="{
        backdropFilter : `blur(${image.blur}px)`,
      }"
    ></div>
    <Transition v-if="image.url !== ''" name="global-background">
      <video
        id="__router__background-video"
        v-if="image.isVideo"
        autoplay
        muted
        loop
        class="absolute left-0 h-full w-full bg-center object-cover -z-10"
      >
        <source :src="image.url" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <Image
        v-else
        :key="image.key"
        :src="image.url"
        id="__router__background-image"
        alt="A custom layout background"
        class-names="absolute left-0 h-full w-full bg-center object-cover -z-10"
      />
    </Transition>
  </div>
</template>
