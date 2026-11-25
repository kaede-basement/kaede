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
import { useQuery } from "@tanstack/vue-query";
import { onClickOutside } from "@vueuse/core";
import { markRaw, useTemplateRef, watch } from "vue";

import { InstanceCreationSections } from "@/constants/application.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import Modrinth from "@/lib/modrinth";
import { usePackSelection } from "@/lib/modrinth/select-pack.ts";
import { globalStates } from "@/states/global.ts";

const { idRoot, projectId, projectIcon, close } = defineProps<{
  "idRoot"     : string;
  "projectId"  : string;
  "projectName": string;
  "projectIcon": string | null;
  "close"      : () => void;
}>();

const container = useTemplateRef("container");

const { data, status, error } = useQuery({
  "queryKey": [
    "modrinth",
    ModrinthAPI.ProjectType,
    (): string => projectId,
    "version",
  ],
  // For some reason, 'useQuery' makes 'data' deeply reactive...
  "queryFn": async () => markRaw(await Modrinth.fetchVersion(projectId)),
});

const { pending, failure, select, stop } = usePackSelection(({ manifest, path }) => {
  Modrinth.applyManifest({ manifest, path });
  close();
  globalStates.pages["add-instance"]?.select?.(InstanceCreationSections[0]);

  if (projectIcon && globalStates.pages["add-instance"]?.instance) {
    globalStates.pages["add-instance"].instance.icon = projectIcon;
  }
});

watch((): string => projectId, stop, { "flush": "sync" });
onClickOutside(container, close);
</script>

<template>
  <div
    :id="idRoot"
    ref="container"
    class="absolute right-4 top-16 z-100 max-h-120 w-80 overflow-y-auto rounded-md bg-neutral-900 text-white"
  >
    <div :id="`${idRoot}-feedback`" class="sticky top-0 bg-neutral-900">
      <button v-if="pending" :id="`${idRoot}-stop`" class="p-2" @click="stop">Stop</button>
      <p v-if="failure" :id="`${idRoot}-failure`" class="break-words p-2" role="alert">
        {{ failure }}
      </p>
    </div>
    <div
      v-if="data"
      :id="`${idRoot}-data`"
      class="w-full flex flex-col break-all text-wrap text-sm"
    >
      <button
        v-for="entry in data"
        :key="entry.id"
        :id="`${idRoot}-${entry.id}`"
        @click="select(entry.files)"
        class="flex flex-nowrap border-b border-neutral-600 p-2 hover:bg-[theme(colors.neutral.100/.1)]"
      >
        <span
          :id="`${idRoot}-${entry.id}-star`"
          class="pointer-events-none w-6 shrink-0"
        >
          {{ entry.featured ? "⭐" : "" }}
        </span>
        <span
          :id="`${idRoot}-${entry.id}-label`"
          class="pointer-events-none w-full"
        >
          {{ entry.name }}
        </span>
        <span
          :id="`${idRoot}-${entry.id}-loader`"
          class="pointer-events-none shrink-0 text-neutral-300"
        >
          {{ entry.loaders[0] }}
        </span>
      </button>
    </div>
    <div
      v-else-if="status !== 'error'"
      :id="`${idRoot}-pending`"
      class="p-2"
    >
      <div :id="`${idRoot}-pending-icon`" class="i-lucide-loader-circle animate-spin"></div>
    </div>
    <div
      v-else
      :id="`${idRoot}-error`"
      class="p-2"
    >
      An error occurred: {{ error }}
    </div>

  </div>
</template>
