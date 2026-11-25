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
import { computed, markRaw } from "vue";

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  ExtendedPatchUIDType,
  PatchIndexType,
} from "@/types/launcher/meta/patch-index.type.ts";

const { handleDropdown, currentFilter, currentPatch } = defineProps<{
  "handleDropdown": (state: boolean, event?: PointerEvent) => void;
  "currentFilter" : "release" | "all";
  "currentPatch"  : ExtendedPatchUIDType;
}>();

const currentInstance = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(
      globalStates.pages?.["add-instance"]?.instance,
      globalStates.minecraft,
    )
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.["add-instance"]?.instanceVersionSearch
  ),
);

const { styles } = useConfigColors();

const queryKey = computed((): Array<unknown> => [
  "meta",
  APIEndpoints.Meta.Paths.Minecraft.Id,
  "versions",
  currentPatch === Patches.Minecraft
    ? "do-not-reload"
    : currentInstance.value?.patchVersions?.["net.minecraft"],
  currentPatch,
]);

const { data, status } = useQuery({
  "queryKey": queryKey,
  "queryFn" : async (): Promise<PatchIndexType["versions"]> => (
    // For some reason, 'useQuery' makes 'data' deeply reactive...
    markRaw(await Launcher.Fetching.fetchAllVersions(
      currentPatch,
      currentInstance.value?.patchVersions?.["net.minecraft"],
    ))
  ),
});

const filteredVersions = computed(() => {
  const search = currentVersionSearch.value?.input ?? "";

  return data.value?.filter(entry => entry.version.includes(search) && (
    currentPatch !== Patches.Minecraft || currentFilter === "all" || entry.type === currentFilter
  )) ?? [];
});

function selectVersion(entry: PatchIndexType["versions"][number]): void {
  if (!currentInstance.value) {
    return;
  }

  // If user changes the minecraft version, we need to reset all patch versions
  const handledPatchVersions = currentPatch === Patches.Minecraft ? {
    [currentPatch]: entry.version,
  } : {
    ...currentInstance.value.patchVersions,
    [currentPatch]: entry.version,
  };

  globalStates.pages["add-instance"].instance = {
    ...currentInstance.value,
    "patchVersions": handledPatchVersions,
  };
}
</script>

<template>
  <div
    id="__add-instance-page__instance-version-dropdown-wrapper"
    class="absolute left-0 top-14 z-50 max-h-73 w-full flex flex-col overflow-y-auto break-all rounded-md text-start text-sm"
    :style="styles.widget"
  >
    <span v-if="filteredVersions.length === 0" id="__add-instance-page__instance-version-dropdown-placeholder" class="p-2">
      {{ status !== "success" ? "Loading..." : data ? "No matches" : "No data?.." }}
    </span>
    <button
      @pointerdown.left="selectVersion(entry)"
      @pointerenter="event => event.buttons === 1 && selectVersion(entry)"
      @pointerup.left="event => handleDropdown(false, event)"
      @click="() => { selectVersion(entry); handleDropdown(false) }"
      v-for="entry in filteredVersions"
      :id="`__add-instance-page__instance-version-dropdown-item-wrapper-${entry.version}`"
      :key="entry.version"
      class="__add-instance-page__instance-version-dropdown-item flex flex-nowrap border-b border-neutral-600 p-2 hover:bg-[theme(colors.neutral.100/.1)]"
      :style="styles.widgetSecondary"
    >
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-star-${entry.version}`"
        class="w-6 shrink-0"
      >
        {{ entry.recommended ? "⭐" : "" }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-version-${entry.version}`"
        class="flex-1"
      >
        {{ entry.version }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-type-${entry.version}`"
        class="flex-1"
      >
        {{ entry?.type }}
      </span>
      <span
        :id="`__add-instance-page__instance-version-dropdown-item-time-${entry.version}`"
        class="flex-1"
      >
        {{ entry.releaseTime }}
      </span>
    </button>
  </div>
</template>
