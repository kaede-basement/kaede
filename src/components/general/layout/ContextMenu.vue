<script setup lang="ts">
import { useElementSize, useWindowSize } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

import ContextMenuChildren from "@/components/general/layout/ContextMenuChildren.vue";
import { globalStates } from "@/states/global.ts";

const { opened, x, y } = defineProps<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>();

const offset: number = 2;

const contextMenu = useTemplateRef<HTMLDivElement>("contextMenu");
const menuSize = useElementSize(contextMenu, undefined, { "box": "border-box" });
const viewport = useWindowSize();

const hasNativeContextMenu = computed((): boolean => (
  globalStates?.development?.enableNativeContextMenu ?? false
));

type MenuPosition = {
  "left"  ?: string;
  "top"   ?: string;
  "right" ?: string;
  "bottom"?: string;
};

const styles = computed<MenuPosition>(previous => {
  if (!opened) {
    return previous ?? {};
  }

  const position: MenuPosition = {};
  const boundaries = {
    "height": viewport.height.value,
    "width" : viewport.width.value,
  };

  /*
   * The browser context menu seems to always go to the right and bottom sides
   * so we place the custom one to left and top
   */
  const toShowNativeMenu: boolean = hasNativeContextMenu.value;
  // By default, the context menu goes to the right and bottom sides
  const isHorizontallyOutOfBounds: boolean = menuSize.width.value + x + offset > boundaries.width;
  const isVerticallyOutOfBounds: boolean = menuSize.height.value + y + offset > boundaries.height;

  if (toShowNativeMenu || isHorizontallyOutOfBounds) {
    position.right = `${boundaries.width - x + offset}px`;
  } else {
    position.left = `${x + offset}px`;
  }

  if (toShowNativeMenu || isVerticallyOutOfBounds) {
    position.bottom = `${boundaries.height - y + offset}px`;
  } else {
    position.top = `${y + offset}px`;
  }

  return position;
});

</script>

<template>
  <Transition name="pop" mode="out-in">
    <div
      v-show="opened"
      ref="contextMenu"
      id="__context_menu__wrapper"
      class="__context_menu__wrapper __context-menu-disable absolute z-9000 flex flex-col gap-1 rounded-md bg-neutral-800 py-1 text-white drop-shadow-lg"
      :style="styles"
    >
      <ContextMenuChildren
        :id-root="`__context-menu__entry`"
        :children="globalStates?.contextMenuItems"
      />
    </div>
  </Transition>
</template>
