<script setup lang="ts">
import { computed, inject } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { InstallablePatches } from "@/constants/meta.ts";
import General from "@/lib/general";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

function handlePatch(uid: string): void {
  console.log(uid);
}
</script>

<template>
  <div id="__add-instance-page__wrapper" class="grid cols-2 h-fit w-full gap-4 lg:cols-5 md:cols-4 sm:cols-3 xl:cols-6">
    <button
      v-for="patch in InstallablePatches"
      :key="patch.uid"
      @click="() => patch?.action?.(patch.uid) ?? handlePatch(patch.uid)"
      :id="`__add-instance-page__item-${patch.id}`"
      class="__add-instance-page__item rounded-md p-2 hover:bg-neutral-800"
      :style="cardStyles"
    >
      <span
        :id="`__add-instance-page__item-inner-${patch.id}`"
        class="relative h-full flex flex-col items-center justify-center gap-4 rounded-md p-4 transition-[background-color] duration-150 hover:bg-[theme(colors.neutral.100/.05)]"
      >
         <Image
           v-if="patch.icon"
           :id="`__add-instance-page__item-icon-${patch.id}`"
           :src="patch.icon"
           :alt="`An icon of the '${patch.uid}' patch`"
           class-names="rounded-md size-12"
         />
        <span :id="`__add-instance-page__item-${patch.id}`" class="block break-all">
          {{ patch.name }}
        </span>
        <MaterialRipple />
      </span>
    </button>
  </div>
</template>