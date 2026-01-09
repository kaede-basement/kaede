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
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import type { DropdownItemType } from "@/types/application/dropdown-item.type.ts";

const { show, id, sizeClassNames, addClassNames, items } = defineProps<{
  "show"          : boolean;
  "id"            : string;
  "addClassNames" : string;
  "sizeClassNames": string;
  "items"         : Array<DropdownItemType>;
}>();
</script>

<template>
  <Transition name="expand">
    <div
      v-if="show"
      :id="`${id}-expand-transform`"
      :class="[
        'rounded-md bg-neutral-900 py-1',
        addClassNames,
        sizeClassNames,
      ]"
    ></div>
  </Transition>
  <Transition name="slide-up">
    <div
      v-if="show"
      :id="id"
      :class="[
        'flex flex-col gap-1',
        'overflow-y-auto rounded-md py-1',
        addClassNames,
        sizeClassNames,
      ]"
    >
      <button
        v-for="item in items"
        :key="item.id"
        :id="item.id"
        :disabled="item.disabled"
        @click="item.onclick"
        class="relative flex flex-nowrap items-center gap-2 p-2 transition-[background-color] hover:bg-[theme(colors.neutral.100/.05)] disabled:bg-transparent disabled:opacity-50"
      >
        <Image
          v-if="item.image"
          :id="`${item.id}-image`"
          class-names="block rounded-md size-12 p-1"
          :src="item.image"
          :alt="`${item.title}'s image logo`"
        />
        <span
          v-else-if="item.icon"
          :id="`${item.id}-icon-wrapper`"
          class="grid size-12 shrink-0 place-items-center"
        >
        <span
          :id="`${item.id}-icon-inner`"
          :class="['block size-8', item.icon]"
        ></span>
      </span>
        <span
          :id="`${item.id}-information-wrapper`"
          class="flex flex-col items-start pr-1"
        >
        <span
          :id="`${item.id}-information-title`"
          class="block font-medium"
        >
          {{ item.title }}
        </span>
        <span
          :id="`${item.id}-information-subtitle`"
          class="block text-neutral-400"
        >
          {{ item.subtitle }}
        </span>
      </span>
      <MaterialRipple :disabled="item.disabled" />
      </button>
    </div>
  </Transition>
</template>
