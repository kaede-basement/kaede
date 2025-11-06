<script setup lang="ts">
import { inject, ref, shallowRef } from "vue";

import MaterialRipple from "@/components/misc/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import type {
  ContextGlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const delayed = ref<boolean>(false);
const tooltip = shallowRef<{
  "top" : number;
  "text": string | undefined;
  "show": boolean;
}>({
  "top" : 16,
  "text": globalStates?.sidebarItems?.[0]?.name,
  "show": false,
});

function closeTooltip(): void {
  tooltip.value = {
    ...tooltip.value,
    "show": false,
  };
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
    delayed.value = true;

    setTimeout(() => {
      tooltip.value = newTooltipInfo;
      delayed.value = false;
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
  <div id="__sidebar__space-placeholder" class="h-full w-20 shrink-0"></div>
  <div
    id="__sidebar__hovering-tooltip"
    class="absolute left-20 top-2 z-49000 w-fit select-none rounded-md bg-neutral-950 p-2 leading-none transition-[transform,opacity]"
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
      class="h-fit min-h-full w-full flex flex-col items-center gap-2 rounded-md bg-neutral-950 p-2"
    >
      <button
        v-for="item in globalStates?.sidebarItems"
        :key="item.icon"
        :id="`__sidebar__entry-${item.icon}-button`"
        :disabled="item.path === globalStates?.page"
        @mousedown="() => handleButtonAction(item.action)"
        @touchstart="() => handleButtonAction(item.action)"
        @click="() => handleButtonAction(item.action)"
        class="relative size-12 flex shrink-0 flex-col items-center justify-center gap-1 rounded-md text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)]"
        :aria-label="item.name"
      >
        <span
          :id="`__sidebar__entry-${item.icon}-icon`"
          :class="[
            item.icon,
            'block size-6 shrink-0',
          ]"
        ></span>
        <MaterialRipple
          :id="`__sidebar__entry-${item.icon}-overlay`"
          :label="item.name"
        />
      </button>
    </TransitionGroup>
  </div>
</template>
