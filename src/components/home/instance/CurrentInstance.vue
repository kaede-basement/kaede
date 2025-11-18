<script setup lang="ts">
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
</script>

<template>
  <button
    id="__home-page__current-instance-button"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2"
  >
    <Image
      id="__home-page__current-instance-logo"
      class-names="rounded-md size-12 p-1"
      src="https://media.forgecdn.net/avatars/thumbnails/286/772/64/64/637305737753885398.png"
      alt="Fabulously optimized"
    />
    <span
      id="__home-page__current-instance-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-instance-information-title"
        class="block font-medium"
      >
        Fabulously Optimized
      </span>
      <span
        id="__home-page__current-instance-information-version"
        class="block text-neutral-400"
      >
        1.21.10
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>