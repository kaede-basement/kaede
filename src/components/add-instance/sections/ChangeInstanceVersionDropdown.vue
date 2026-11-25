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
import { computed, markRaw, nextTick } from "vue";

import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useVersionViewport } from "@/composables/use-version-viewport.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import { translate } from "@/lib/general/translate.ts";
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

const { data, status, refetch } = useQuery({
  "queryKey": queryKey,
  "queryFn" : async (): Promise<PatchIndexType["versions"]> => (
    // For some reason, 'useQuery' makes 'data' deeply reactive...
    markRaw(await Launcher.Fetching.fetchAllVersions(
      currentPatch,
      currentInstance.value?.patchVersions?.["net.minecraft"],
    ))
  ),
});

const filteredVersions = computed(() => (data.value ?? []).filter(({ version, type }) => (
  version.includes(currentVersionSearch.value?.input ?? "") &&
  (currentFilter === "all" || type === currentFilter || currentPatch !== Patches.Minecraft)
)));
const rowHeight = 36;
const { list, containerProps, wrapperProps, scrollTo } = useVersionViewport(
  filteredVersions, rowHeight,
);

async function focusRow(index: number): Promise<void> {
  const next = Math.max(0, Math.min(index, filteredVersions.value.length - 1));

  const selector = `[data-index="${next}"]`;

  if (!containerProps.ref.value?.querySelector(selector)) {
    scrollTo(next);
    await nextTick();
  }
  containerProps.ref.value?.querySelector<HTMLButtonElement>(selector)?.focus();
}

function selectVersion(extractedVersion: string): void {
  if (!currentInstance.value) {
    return;
  }

  // If user changes the minecraft version, we need to reset all patch versions
  const handledPatchVersions = currentPatch === Patches.Minecraft ? {
    [currentPatch]: extractedVersion,
  } : {
    ...currentInstance.value.patchVersions,
    [currentPatch]: extractedVersion,
  };

  globalStates.pages["add-instance"].instance = {
    ...currentInstance.value,
    "patchVersions": handledPatchVersions,
  };
}
</script>

<template>
  <div
    v-bind="containerProps"
    id="__add-instance-page__instance-version-dropdown-wrapper"
    class="absolute left-0 top-14 z-50 max-h-73 w-full overflow-y-auto break-all rounded-md text-start text-sm"
    :style="styles.widget"
    @keydown.esc="handleDropdown(false)"
  >
    <p v-if="status === 'error'" id="__version-dropdown-error">
      {{ translate("versions.failed") }}
      <button id="__version-dropdown-retry" @click="refetch()">{{ translate("general.retry") }}</button>
    </p>
    <p v-else-if="filteredVersions.length === 0" id="__version-dropdown-status">
      {{ translate(status === "pending" ? "general.loading" : "versions.empty") }}
    </p>
    <div v-else id="__version-dropdown-rows" v-bind="wrapperProps">
      <button
        v-for="{ data: entry, index } in list"
        :data-index="index"
        :title="entry.version"
        :aria-label="entry.version"
        @keydown.down.prevent="focusRow(index + 1)"
        @keydown.up.prevent="focusRow(index - 1)"
        @keydown.home.prevent="focusRow(0)"
        @keydown.end.prevent="focusRow(filteredVersions.length - 1)"
        @pointerdown.left="selectVersion(entry.version)"
        @pointerover="event => event.buttons === 1 && selectVersion(entry.version)"
        @pointerup.left="event => { selectVersion(entry.version); handleDropdown(false, event) }"
        @click="selectVersion(entry.version); handleDropdown(false)"
        :id="`__add-instance-page__instance-version-dropdown-item-wrapper-${entry.version}`"
        :key="entry.version"
        class="__add-instance-page__instance-version-dropdown-item w-full flex shrink-0 flex-nowrap overflow-hidden border-b border-neutral-600 p-2 text-start hover:bg-[theme(colors.neutral.100/.1)]"
        :style="[styles.widgetSecondary, { height: rowHeight + 'px' }]"
      >
        <span
          :id="`__add-instance-page__instance-version-dropdown-item-star-${entry.version}`"
          class="w-6 shrink-0"
        >
          {{ entry.recommended ? "⭐" : "" }}
        </span>
        <span
          :id="`__add-instance-page__instance-version-dropdown-item-version-${entry.version}`"
          class="flex-1 truncate"
        >
          {{ entry.version }}
        </span>
        <span
          :id="`__add-instance-page__instance-version-dropdown-item-type-${entry.version}`"
          class="flex-1 truncate"
        >
          {{ entry?.type }}
        </span>
        <span
          :id="`__add-instance-page__instance-version-dropdown-item-time-${entry.version}`"
          class="flex-1 truncate"
        >
          {{ entry.releaseTime }}
        </span>
      </button>
    </div>
  </div>
</template>
