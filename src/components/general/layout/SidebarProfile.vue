<script setup lang="ts">
import { inject } from "vue";

import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { Routes } from "@/constants/routes.ts";
import type General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const { innerStyles, handleMouseOver, handleButtonAction } = defineProps<{
  "innerStyles"       : ReturnType<typeof General["getSidebarInnerStyles"]>;
  "handleMouseOver"   : (event: MouseEvent) => void;
  "handleButtonAction": (event: PointerEvent, action: () => void) => void;
}>();

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

function handleProfileNavigation(): void {
  GlobalStateHelpers.Pages.navigate(Routes.Profile);
}
</script>

<template>
  <div
    id="__sidebar__inner-profile"
    @mouseover="handleMouseOver"
    class="shrink-0 rounded-md p-2 backdrop-blur-md"
    :style="innerStyles"
  >
    <button
      id="__sidebar__entry-profile-button"
      :disabled="Routes.Profile === globalStates?.pages?.current"
      @pointerdown="(event: PointerEvent) => handleButtonAction(event, handleProfileNavigation)"
      class="relative grid size-12 shrink-0 place-items-center rounded-md text-white transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
      aria-label="profile"
    >
      <Image
        :id="`__sidebar__entry-profile-image`"
        :src="`https://new.freesmlauncher.org/skins/windstone.png`"
        :alt="`An image for the profile sidebar item`"
        class-names="rounded-md size-8"
      />
      <MaterialRipple
        :id="`__sidebar__entry-profile-overlay`"
        :label="`profile`"
        :colors="{
          ripple  : globalStates?.layout?.sidebar?.ripple,
          sparkles: globalStates?.layout?.sidebar?.sparkles,
        }"
      />
    </button>
  </div>
</template>
