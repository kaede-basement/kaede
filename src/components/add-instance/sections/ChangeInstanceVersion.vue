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
import { fetch } from "@tauri-apps/plugin-http";
import { onClickOutside } from "@vueuse/core";
import { computed, inject, ref, useTemplateRef } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { PatchIndexType, PatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const { data, status } = useQuery({
  "queryKey": ["meta", APIEndpoints.Meta.Paths.Minecraft.Id, "versions"],
  "queryFn" : async (): Promise<PatchIndexType["versions"]> => {
    const response: Response = await fetch(
      APIEndpoints.Meta.Base +
      APIEndpoints.Meta.Paths.Minecraft.Id,
    );
    const parsed: unknown = await response.json();

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("The provided metadata is invalid");
    }

    if (!("versions" in parsed) || !Array.isArray(parsed.versions)) {
      throw new Error("No versions in the provided metadata");
    }

    const entry: unknown = parsed.versions?.[0];

    if (typeof entry !== "object" || entry === null) {
      throw new Error("The parsed versions are invalid");
    }

    if (!("version" in entry) || !("type" in entry)) {
      throw new Error("No version or type fields in the parsed versions");
    }

    return parsed.versions;
  },
});

const target = useTemplateRef("target");

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const selector = ref<boolean>(false);

const filteredVersions = computed((): PatchIndexType["versions"] => {
  if (status.value !== "success") {
    return [{
      "version"    : "Loading...",
      "recommended": false,
      "releaseTime": "",
      "sha256"     : "",
    }];
  }

  if (!data.value) {
    return [{
      "version"    : "No data?..",
      "recommended": false,
      "releaseTime": "",
      "sha256"     : "",
    }];
  }

  const filteringValue: string | undefined = currentVersionSearch.value?.input;

  if (!filteringValue) {
    return data.value;
  }

  const filteredData = data
    .value
    .filter(({ version }) => version.includes(filteringValue));

  if (filteredData.length === 0) {
    return [{
      "version"    : "No matches",
      "recommended": false,
      "releaseTime": "",
      "sha256"     : "",
    }];
  }

  return filteredData;
});
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
const currentPatch = computed((): PatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

function handleDropdown(state: boolean): void {
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
function selectVersion(): void {}

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
      v-if="currentInstance?.patchVersions?.[currentPatch]"
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
    <template v-if="status === 'success'">
      <Transition name="slide-up">
        <button
          v-if="selector"
          id="__add-instance-page__instance-version-dropdown-wrapper"
          class="absolute left-0 top-14 z-50 max-h-[274px] w-full flex flex-col gap-2 overflow-y-auto rounded-md p-2"
          :style="cardStyles"
          @click="selectVersion"
        >
          <span
            v-for="entry in filteredVersions"
            :id="`__add-instance-page__instance-version-dropdown-item-${entry.version}`"
            :key="entry.version"
            class="__add-instance-page__instance-version-dropdown-item flex flex-nowrap rounded-md bg-neutral-800 p-2 text-sm text-neutral-300 leading-none"
          >
            <span
              :id="`__add-instance-page__instance-version-dropdown-item-${entry.version}-star`"
              class="w-6 shrink-0 text-start"
            >
              {{ entry.recommended ? "⭐" : "" }}
            </span>
            <span
              :id="`__add-instance-page__instance-version-dropdown-item-${entry.version}-version`"
              class="flex-1 text-start"
            >
              {{ entry.version }}
            </span>
            <span
              :id="`__add-instance-page__instance-version-dropdown-item-${entry.version}-type`"
              class="flex-1 text-start"
            >
              {{ entry?.type }}
            </span>
            <span
              :id="`__add-instance-page__instance-version-dropdown-item-${entry.version}-time`"
              class="flex-1 text-start"
            >
              {{ entry.releaseTime }}
            </span>
          </span>
        </button>
      </Transition>
    </template>
  </div>
</template>