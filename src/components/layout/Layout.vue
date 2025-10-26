<script setup lang="ts">
import Sidebar from "@/components/layout/Sidebar.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import { ref } from "vue";
import ContextMenu from "@/components/layout/ContextMenu.vue";
import { useEventListener } from "@vueuse/core";

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
    target?.className?.includes("context_menu") ||
    target?.parentElement?.className?.includes?.("context_menu_button")
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

useEventListener(window, "mousedown", (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  if (
    target?.className?.includes("context_menu") ||
    target?.parentElement?.className?.includes?.("context_menu_button")
  ) {
    return;
  }

  closeContextMenu();
});
</script>

<template>
  <div
    @contextmenu.prevent
    @contextmenu="showContextMenu"
    class="flex flex-nowrap gap-0 relative w-full h-vh overflow-hidden"
  >
    <div id="__kaede-extensions" class="block" />
    <ContextMenu
      :opened="contextMenu.opened"
      :x="contextMenu.x"
      :y="contextMenu.y"
    />
    <Sidebar />
    <!-- Pages error boundary -->
    <ErrorBoundary>
      <template #default>
        <slot />
      </template>

      <!-- In case of an error, show this template -->
      <template #error="{ currentError }">
        <div class="h-full w-full flex flex-col select-text gap-4 bg-black p-8 text-white">
          <p class="text-xl font-light">
            Something went wrong. {{ currentError?.value?.name }}: {{ currentError?.value?.message }}
          </p>
          <p class="break-words text-sm text-neutral-300 font-light">
            {{ currentError?.value?.stack }}
          </p>
        </div>
      </template>
    </ErrorBoundary>
  </div>
</template>
