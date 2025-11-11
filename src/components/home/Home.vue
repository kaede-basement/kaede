<script setup lang="ts">
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
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
          В большой семье
        </p>
        <p
          id="__home-page__header-subtitle"
          class="text-lg text-neutral-300"
        >
          Еблом не щёлкают.
        </p>
      </div>
      <div
        id="__home-page__content"
        class="flex flex-nowrap items-end justify-between gap-2 pr-2 pb-2"
      >
        <div
          class="flex flex-col items-stretch gap-0"
        >
          <button
            class="relative p-2 rounded-md flex flex-nowrap gap-2 items-center"
          >
            <Image
              id="__"
              class-names="rounded-md size-12 transition-none p-1"
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
            class="relative p-2 rounded-md flex flex-nowrap gap-2 items-center"
          >
            <span class="size-12 shrink-0 grid place-items-center">
              <span class="block size-8 i-lucide-clock" />
            </span>
            <span class="flex flex-col items-start pr-1">
              <p class="font-medium">
                Playtime
              </p>
              <p class="text-neutral-400 text-sm">
                73 hours, 8 minutes, 56 seconds
              </p>
            </span>
            <MaterialRipple />
          </button>
        </div>
        <div class="flex flex-nowrap gap-1 p-2">
          <button class="relative px-4 py-2 w-fit rounded-l-md rounded-r-sm bg-white text-black">
            <span class="block">
              Launch
            </span>
            <MaterialRipple
              :colors="{ 'ripple': '#00000033', 'sparkles': '0 0 0' }"
            />
          </button>
          <button class="relative w-fit px-1 py-2 rounded-l-sm rounded-r-md bg-white text-black">
            <span class="block i-lucide-chevron-down" />
            <MaterialRipple
              :colors="{ 'ripple': '#00000033', 'sparkles': '0 0 0' }"
            />
          </button>
        </div>
      </div>
    </div>
  </PageWrapper>
</template>
