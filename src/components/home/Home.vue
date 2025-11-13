<script setup lang="ts">
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import GlobalStateHelpers from "@/lib/global-state-helpers";
</script>

<template>
  <PageWrapper>
    <div id="__home-page__wrapper" class="h-full flex flex-col justify-between gap-2">
      <div
        id="__home-page__header-wrapper"
        class="flex flex-col gap-2 px-2 pt-6"
      >
        <p
          id="__home-page__header-title"
          class="text-3xl"
        >
          A promising future
        </p>
        <p
          id="__home-page__header-subtitle"
          class="text-lg text-neutral-300"
        >
          Without JavaScript
        </p>
      </div>
      <div
        id="__home-page__content"
        class="flex flex-nowrap items-end justify-between gap-2 pb-2 pr-2"
      >
        <div
          class="flex flex-col items-stretch gap-0"
        >
          <button
            class="relative flex flex-nowrap items-center gap-2 rounded-md p-2"
          >
            <Image
              id="__"
              class-names="rounded-md size-12 p-1"
              src="https://media.forgecdn.net/avatars/thumbnails/286/772/64/64/637305737753885398.png"
              alt="Fabulously optimized"
            />
            <span class="flex flex-col items-start pr-1">
              <p class="font-medium">
                Fabulously Optimized
              </p>
              <p class="text-neutral-400">
                1.21.10
              </p>
            </span>
            <MaterialRipple />
          </button>
          <button
            class="relative flex flex-nowrap items-center gap-2 rounded-md p-2"
          >
            <span class="grid size-12 shrink-0 place-items-center">
              <span class="i-lucide-clock block size-8" />
            </span>
            <span class="flex flex-col items-start pr-1">
              <p class="font-medium">
                Playtime
              </p>
              <p class="text-sm text-neutral-400">
                73 hours, 8 minutes, 56 seconds
              </p>
            </span>
            <MaterialRipple />
          </button>
        </div>
        <div class="flex flex-nowrap gap-1 p-2">
          <button @click="() => GlobalStateHelpers.change('development', {
            ...GlobalStateHelpers.get().development,
            'enabled'        : true,
            'enableDebugMode': !GlobalStateHelpers.get().development.enableDebugMode,
          })" class="relative w-fit rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black">
            <span class="block">
              Launch
            </span>
            <MaterialRipple
              :colors="{ ripple: '#00000033', sparkles: '0 0 0' }"
            />
          </button>
          <button class="relative w-fit rounded-l-sm rounded-r-md bg-white px-1 py-2 text-black">
            <span class="i-lucide-chevron-down block" />
            <MaterialRipple
              :colors="{ ripple: '#00000033', sparkles: '0 0 0' }"
            />
          </button>
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
