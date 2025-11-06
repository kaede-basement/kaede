<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";

import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ContextMenu from "@/components/layout/ContextMenu.vue";
import Sidebar from "@/components/layout/Sidebar.vue";
import { ApplicationNamespace } from "@/constants/application.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();
const contextMenu = ref<{
  "opened": boolean;
  "x"     : number;
  "y"     : number;
}>({ "opened": false, "x": 0, "y": 0 });

function closeContextMenu(): void {
  contextMenu.value.opened = false;
}
function showContextMenu(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  if (
    target?.className?.includes("__context_menu__wrapper") ||
    target?.parentElement?.className?.includes?.("__context_menu__entry")
  ) {
    return;
  }

  if (
    target?.className?.includes?.("__context-menu-disable") ||
    target?.className?.includes?.("_rippleOverlay")
  ) {
    closeContextMenu();

    return;
  }

  contextMenu.value.opened = true;
  contextMenu.value.x = event.clientX;
  contextMenu.value.y = event.clientY;
}

window[ApplicationNamespace].functions.showContextMenu = showContextMenu;
window[ApplicationNamespace].functions.closeContextMenu = closeContextMenu;

useEventListener(window, "mousedown", (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  if (
    target?.className?.includes("__context_menu__wrapper") ||
    target?.parentElement?.className?.includes?.("__context_menu__entry")
  ) {
    return;
  }

  closeContextMenu();
});
</script>

<template>
  <div
    id="__layout__wrapper"
    @contextmenu.prevent
    @contextmenu="showContextMenu"
    class="relative h-vh w-full flex flex-nowrap gap-0 overflow-hidden text-white"
  >
    <ContextMenu
      :opened="contextMenu.opened"
      :x="contextMenu.x"
      :y="contextMenu.y"
    />
    <Sidebar />
    <!-- Pages error boundary -->
    <ErrorBoundary :reset-key="page">
      <template #default>
        <slot />
      </template>

      <!-- In case of an error, show this template -->
      <template #error="{ currentError }">
        <div id="__layout__error-wrapper" class="h-full w-full flex flex-col select-text gap-4 bg-black p-8 text-white">
          <p id="__layout__error-message" class="text-xl font-light">
            Something went wrong. {{ currentError?.value?.name }}: {{ currentError?.value?.message }}
          </p>
          <p id="__layout__error-stack" class="break-words text-sm text-neutral-300 font-light">
            {{ currentError?.value?.stack }}
          </p>
        </div>
      </template>
    </ErrorBoundary>
  </div>
</template>
