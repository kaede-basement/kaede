<script setup lang="ts">
import { Command } from "@tauri-apps/plugin-shell";
import { inject } from "vue";

import MaterialRipple from "@/components/misc/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import type {
  ContextGlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

async function startElysia(): Promise<void> {
  const command = Command.sidecar("sidecars/bun-sidecar", [
    "hello",
    "from a fucking javascript server",
  ]);
  const output = await command.execute();

  console.log(output);
}
</script>

<template>
  <div class="shrink-0 h-full w-20"></div>
  <TransitionGroup name="fade" tag="div" class="absolute left-0 top-0 h-vh w-20 flex flex-col items-center bg-[theme(colors.neutral.950)] z-10000">
    <button
      v-for="item in globalStates?.sidebarItems"
      :key="item.path"
      :disabled="item.path === globalStates?.page"
      @mousedown="item.action"
      @touchstart="item.action"
      @click="item.action"
      class="relative size-20 flex shrink-0 flex-col items-center justify-center gap-1 text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.2)]"
      name="sidebar__item"
    >
      <span
        :class="[
          item.icon,
          'block size-6 shrink-0',
        ]"
      ></span>
      <span name="sidebar__item_text" class="block shrink-0 break-all text-balance text-sm">
        {{ item.name }}
      </span>
      <MaterialRipple />
    </button>
    <button key="unknown-button" @click="startElysia">
      Heh
    </button>
  </TransitionGroup>
</template>
