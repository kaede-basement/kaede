<script setup lang="ts">
import { computed, inject, ref } from "vue";

import CleanInstance from "@/components/add-instance/sections/CleanInstance.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { GlobalStatesContextKey, InstanceCreationSections } from "@/constants/application.ts";
import General from "@/lib/general";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const selected = ref<string>(InstanceCreationSections[0].id);

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

function handleModeSelect(id: string): void {
  selected.value = id;
}
</script>

<template>
  <PageWrapper>
    <div
      id="__add-instance-page__wrapper"
      class="h-full w-full flex flex-col gap-2 py-2 pr-2"
    >
      <div
        id="__add-instance-page__type-selector"
        class="h-fit w-full flex shrink-0 gap-2 overflow-x-auto rounded-md p-2"
        :style="cardStyles"
      >
        <button
          v-for="mode in InstanceCreationSections"
          :key="mode.id"
          :disabled="selected === mode.id"
          @click="() => mode?.action?.(mode.id) ?? handleModeSelect(mode.id)"
          :id="`__add-instance-page__type-selector-item-${mode.id}`"
          class="__add-instance-page__type-selector-item relative flex shrink-0 flex-nowrap items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
        >
          <Image
            :id="`__add-instance-page__type-selector-image-${mode.id}`"
            :src="mode.image"
            :alt="`An icon of the '${mode.name}' instance mode selector`"
            class-names="size-6"
          />
          <span
            :id="`__add-instance-page__type-selector-item-label-${mode.id}`"
          >
            {{ mode.name }}
          </span>
          <MaterialRipple />
        </button>
      </div>
      <CleanInstance v-if="selected === 'clean-minecraft'" />
      <div v-else id="__add-instance-page__page-placeholder"></div>
    </div>
  </PageWrapper>
</template>
