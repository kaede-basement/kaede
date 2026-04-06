<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { computed, inject } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);
const aspectRatio = computed((): string => {
  if (!currentInstance.value) {
    return "0:0";
  }

  const width: number = currentInstance.value.windowWidth;
  const height: number = currentInstance.value.windowHeight;
  const common: number = General.gcd(width, height);

  return `${width / common}:${height / common}`;
});
const aspectRatioWidth = computed((): number => {
  if (!currentInstance.value) {
    return 1;
  }

  const actual: number = 128 * (
    currentInstance.value.windowWidth / currentInstance.value.windowHeight
  );

  // Cap at 3000 to avoid large DOM element width
  return Math.min(actual, 3000);
});

function handleWidthChange(value: string): void {
  const width: number = Number(value);

  if (!currentInstance.value || Number.isNaN(width)) {
    return;
  }

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "windowWidth": width,
    },
  });
}
function handleHeightChange(value: string): void {
  const height: number = Number(value);

  if (!currentInstance.value || Number.isNaN(height)) {
    return;
  }

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "windowHeight": height,
    },
  });
}
</script>

<template>
  <div
    id="__add-instance-page__instance-resolution"
    class="max-w-[50%] flex flex-1 flex-col gap-2 rounded-md p-2 lg:max-w-[33%]"
    :style="cardStyles"
  >
    <div
      id="__add-instance-page__instance-resolution-display"
      class="relative h-48 flex flex-col items-center gap-4 overflow-hidden rounded-md bg-neutral-800 py-4"
    >
      <p
        id="__add-instance-page__instance-resolution-title"
        class="text-neutral-300 leading-none"
      >
        Aspect Ratio
      </p>
      <p
        id="__add-instance-page__instance-resolution-aspect-ratio-label"
        class="absolute left-[50%] top-[50%] z-10 translate-x-[-50%] translate-y-[calc(-50%+15px)] text-3xl text-neutral-300 leading-none"
      >
        {{ aspectRatio }}
      </p>
      <div
        id="__add-instance-page__instance-resolution-display-aspect-ratio"
        class="absolute top-12 h-32 border border-blue bg-blue-950 transition-[width]"
        :style="{
          'width': `${aspectRatioWidth}px`,
        }"
      ></div>
    </div>
  </div>
  <div
    id="__add-instance-page__instance-other-settings-wrapper"
    class="lg:flex-2 flex flex-1 flex-col gap-2"
  >
    <div
      id="__add-instance-page__instance-other-width"
      class="rounded-md p-2"
      :style="cardStyles"
    >
      <CustomInput
        icon="i-lucide-unfold-horizontal"
        placeholder="Window Width"
        id-root="__add-instance-page__instance-other-width"
        type="number"
        tooltip="Window width of the instance"
        :debounce-time="300"
        :default-value="currentInstance?.windowWidth"
        :listen-to-events="true"
        :on-input="handleWidthChange"
        :on-blur="handleWidthChange"
        :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
      />
    </div>
    <div
      id="__add-instance-page__instance-other-height"
      class="rounded-md p-2"
      :style="cardStyles"
    >
      <CustomInput
        icon="i-lucide-unfold-vertical"
        placeholder="Window Height"
        id-root="__add-instance-page__instance-other-height"
        type="number"
        tooltip="Window height of the instance"
        :debounce-time="300"
        :default-value="currentInstance?.windowHeight"
        :listen-to-events="true"
        :on-input="handleHeightChange"
        :on-blur="handleHeightChange"
        :class-names="{ 'wrapper': 'h-8 w-full sm:w-full' }"
      />
    </div>
  </div>
</template>