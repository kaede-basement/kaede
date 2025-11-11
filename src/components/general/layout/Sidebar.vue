<script setup lang="ts">
import { inject, ref, shallowRef } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import iochiMariCat from "@/resources/iochi_mari_cat.webp";
import type {
  ContextGlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const delayed = ref<NodeJS.Timeout | undefined>(undefined);
const tooltip = shallowRef<{
  "top" : number;
  "text": string | undefined;
  "show": boolean;
}>({
  "top" : 16,
  "text": globalStates?.sidebarItems?.[0] === "divider"
    ? "None"
    : globalStates?.sidebarItems?.[0]?.name,
  "show": false,
});

function removeTimeout(): void {
  clearTimeout(delayed.value);

  delayed.value = undefined;
}
function closeTooltip(): void {
  tooltip.value = {
    ...tooltip.value,
    "show": false,
  };

  removeTimeout();
}
function handleMouseOver(event: MouseEvent): void {
  if (delayed.value) {
    return;
  }

  const overlayTarget = event?.target as HTMLButtonElement;

  if (!overlayTarget || !overlayTarget?.id?.startsWith?.("__sidebar__entry")) {
    return;
  }

  const boundingRectangle = overlayTarget?.getBoundingClientRect?.();
  const offsetTop = boundingRectangle?.top;
  const textContent = overlayTarget?.ariaLabel;

  if (!offsetTop || !textContent) {
    closeTooltip();

    return;
  }

  const newTooltipInfo = {
    "top" : offsetTop,
    "text": textContent,
    "show": true,
  };

  if (!tooltip.value.show) {
    tooltip.value = {
      ...newTooltipInfo,
      "show": false,
    };

    delayed.value = setTimeout(() => {
      tooltip.value = newTooltipInfo;

      removeTimeout();
    }, 200);

    return;
  }

  tooltip.value = newTooltipInfo;
}
function handleButtonAction(action: () => void): void {
  action();
  closeTooltip();
}
</script>

<template>
  <div
    id="__sidebar__hovering-tooltip"
    class="pointer-events-none absolute left-20 top-2 z-49000 w-fit transform-gpu select-none rounded-md bg-neutral-950 p-2 leading-none transition-[transform,opacity]"
    :style="{
      transform: `translateY(${tooltip.top}px)`,
      opacity  : tooltip.show ? 1 : 0,
    }"
  >
    {{ tooltip.text }}
  </div>
  <div
    id="__sidebar__wrapper"
    class="thin-scrollbar scroll-gutter-stable-both absolute bottom-0 left-0 top-0 z-10000 w-20 overflow-x-hidden overflow-y-auto py-2"
  >
    <TransitionGroup
      @mouseover="handleMouseOver"
      @mouseleave="closeTooltip"
      name="fade"
      tag="div"
      id="__sidebar__inner"
      class="h-fit min-h-full w-full flex flex-col items-center gap-2 rounded-md p-2 backdrop-blur-md bg-[theme(colors.neutral.950/.3)]"
    >
      <template
        v-for="(item, index) in globalStates?.sidebarItems"
        :key="item === 'divider' ? `divider-${index}` : item.icon"
      >
        <button
          v-if="item !== 'divider'"
          :id="`__sidebar__entry-${item.icon}-button`"
          :disabled="item.path === globalStates?.pages?.current"
          @mousedown="() => handleButtonAction(item.action)"
          @touchstart="() => handleButtonAction(item.action)"
          @click="() => handleButtonAction(item.action)"
          class="relative grid size-12 shrink-0 place-items-center rounded-md text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
          :aria-label="item.name"
        >
        <span
          v-if="item.icon"
          :id="`__sidebar__entry-${item.icon}-icon`"
          :class="[
            item.icon,
            'block size-6 shrink-0',
          ]"
        ></span>
          <Image
            v-else-if="item.image"
            :id="`__sidebar__entry-${item.icon}-image`"
            :src="item.image"
            :alt="`An image for the ${item.name} sidebar item`"
            class-names="rounded-md size-8"
          />
          <MaterialRipple
            :id="`__sidebar__entry-${item.icon}-overlay`"
            :label="item.name"
          />
        </button>
        <div
          v-else
          :id="`__sidebar__entry-divider-${index}`"
          class="h-[1px] w-full bg-[theme(colors.neutral.100/.1)]"
        ></div>
      </template>
    </TransitionGroup>
    <Image
      :src="iochiMariCat"
      id="__sidebar__entry-iochi-mari-cat"
      alt="Iochi Mari, a character from Blue Archive"
      class-names="fixed bottom-2 left-2 size-16 rounded-md overflow-hidden opacity-20 pointer-events-none"
    />
  </div>
</template>
