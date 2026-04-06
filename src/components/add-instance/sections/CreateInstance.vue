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

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import General from "@/lib/general";
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
</script>

<template>
  <div
    id="__add-instance-page__create-instance-wrapper"
    class="w-fit rounded-md p-2"
    :style="cardStyles"
  >
    <button
      id="__add-instance-page__create-instance-button"
      class="relative rounded-md bg-neutral-800 px-2 py-1"
      @click="() => Instances.create(currentInstance)"
    >
      Create an Instance
      <MaterialRipple />
    </button>
  </div>
</template>