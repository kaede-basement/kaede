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
import { computed, inject, ref, useTemplateRef } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  ExtendedPatchUIDType,
  PatchIndexType,
} from "@/types/launcher/meta/patch-index.type.ts";

const target = useTemplateRef("target");

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const selector = ref<boolean>(false);

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => (
    Instances.extractSavedFromPages(globalStates)
  ),
);
const currentVersionSearch = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instanceVersionSearch"] => (
    globalStates?.pages?.states?.["add-instance"]?.instanceVersionSearch
  ),
);
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const queryKey = computed((): Array<unknown> => [
  "meta",
  APIEndpoints.Meta.Paths.Minecraft.Id,
  "versions",
  currentPatch.value === Patches.Minecraft
    ? "do-not-reload"
    : currentInstance.value?.patchVersions?.["net.minecraft"],
  currentPatch.value,
]);

const { data, status } = useQuery({
  "queryKey": queryKey,
  "queryFn" : (): Promise<PatchIndexType["versions"]> => {
    return Launcher.Fetching.fetchAllVersions(
      currentPatch.value,
      currentInstance.value?.patchVersions?.["net.minecraft"],
    );
  },
});

const noMatches = {
  "version"    : "No matches",
  "recommended": false,
  "releaseTime": "",
  "sha256"     : "",
} as const;

const filteredVersions = computed((): PatchIndexType["versions"] => {
  if (status.value !== "success" || !data.value) {
    return [{
      "version": status.value === "success"
        ? "No data?.."
        : "Loading...",
      "recommended": false,
      "releaseTime": "",
      "sha256"     : "",
    }];
  }

  const filteringValue: string | undefined = currentVersionSearch.value?.input;

  if (!filteringValue) {
    if (data.value.length === 0) {
      return [noMatches];
    }

    return data.value;
  }

  const filteredData = data
    .value
    .filter(({ version }) => version.includes(filteringValue));

  if (filteredData.length === 0) {
    return [noMatches];
  }

  return filteredData;
});
const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

function handleDropdown(state: boolean, event?: PointerEvent): void {
  const target = event?.target as HTMLButtonElement | undefined;

  if (target?.id === "__add-instance-page__instance-version-dropdown-wrapper") {
    return;
  }

  selector.value = state;
}
function handleVersionSearch(input: string): void {
  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instanceVersionSearch": {
      "patch": Patches.Minecraft,
      ...currentVersionSearch.value,
      input,
    },
  });
}
function selectVersion(event: MouseEvent): void {
  const target = event?.target as HTMLSpanElement | undefined;

  if (!target) {
    return;
  }

  // ["__add", "instance", "page__instance", "version", "dropdown", "item", element_type, version]
  const splitId: Array<string> = target?.id?.split?.("-");
  const extractedVersion: string = splitId.slice(7).join("-");

  if (
    !extractedVersion ||
    !currentInstance.value ||
    !currentPatch.value ||
    // Sometimes it may happen...
    extractedVersion === "Loading..."
  ) {
    return;
  }

  // If user changes the minecraft version, we need to reset all patch versions
  const handledPatchVersions = currentPatch.value === Patches.Minecraft ? {
    [currentPatch.value]: extractedVersion,
  } : {
    ...currentInstance.value.patchVersions,
    [currentPatch.value]: extractedVersion,
  };

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "patchVersions": handledPatchVersions,
    },
  });
}
function slideOverVersions(event: MouseEvent): void {
  const pressed: number = event.buttons;

  // '1' means that the user has clicked the primary mouse button
  if (pressed !== 1) {
    return;
  }

  selectVersion(event);
}

onClickOutside(target, () => handleDropdown(false));
</script>

<template>
  <div
    ref="target"
    id="__add-instance-page__instance-version"
    class="relative flex flex-nowrap gap-2 rounded-md p-2"
    :style="cardStyles"
  >
    <div
      v-if="currentInstance?.patchVersions?.[Patches.Minecraft]"
      id="__add-instance-page__instance-version-selected-badge"
      class="grid h-full place-items-center rounded-md bg-neutral-800 px-2 text-neutral-300 leading-none"
      :data-tooltip="`Selected version of '${Patches.Minecraft}'`"
    >
      {{ currentInstance.patchVersions[Patches.Minecraft] }}
    </div>
    <div
      v-if="currentPatch !== Patches.Minecraft && currentInstance?.patchVersions?.[currentPatch]"
      id="__add-instance-page__instance-version-selected-badge"
      class="grid h-full place-items-center rounded-md bg-neutral-800 px-2 text-neutral-300 leading-none"
      :data-tooltip="`Selected version of '${currentPatch}'`"
    >
      {{ currentInstance.patchVersions[currentPatch] }}
    </div>
    <CustomInput
      icon="i-lucide-search"
      id-root="__add-instance-page__instance-version"
      type="text"
      :placeholder="`Version of '${currentPatch}'`"
      :tooltip="`Searching for this version of '${currentPatch}'...`"
      :debounce-time="300"
      :default-value="currentVersionSearch?.input"
      :on-input="handleVersionSearch"
      @click="() => handleDropdown(true)"
      :class-names="{ 'wrapper': 'h-8 flex-1' }"
    />
    <Transition name="slide-up">
      <button
        v-if="selector"
        id="__add-instance-page__instance-version-dropdown-wrapper"
        class="absolute left-0 top-14 z-50 max-h-[274px] w-full flex flex-col overflow-y-auto rounded-md"
        :style="cardStyles"
        @pointerdown="selectVersion"
        @pointerover="slideOverVersions"
        @pointerup="event => handleDropdown(false, event)"
      >
        <span
          v-for="entry in filteredVersions"
          :id="`__add-instance-page__instance-version-dropdown-item-wrapper-${entry.version}`"
          :key="entry.version"
          class="__add-instance-page__instance-version-dropdown-item flex flex-nowrap border-b border-neutral-600 px-2 py-3 text-sm text-neutral-300 leading-none hover:bg-neutral-800"
        >
          <span
            :id="`__add-instance-page__instance-version-dropdown-item-star-${entry.version}`"
            class="w-6 shrink-0 text-start"
          >
            {{ entry.recommended ? "⭐" : "" }}
          </span>
          <span
            :id="`__add-instance-page__instance-version-dropdown-item-version-${entry.version}`"
            class="flex-1 text-start"
          >
            {{ entry.version }}
          </span>
          <span
            :id="`__add-instance-page__instance-version-dropdown-item-type-${entry.version}`"
            class="flex-1 text-start"
          >
            {{ entry?.type }}
          </span>
          <span
            :id="`__add-instance-page__instance-version-dropdown-item-time-${entry.version}`"
            class="flex-1 text-start"
            v-if="entry.releaseTime"
          >
            {{ new Date(entry.releaseTime).toDateString() }}
          </span>
        </span>
      </button>
    </Transition>
  </div>
</template>