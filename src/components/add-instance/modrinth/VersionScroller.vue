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
import { computed, markRaw, ref } from "vue";

import Checkbox from "@/components/general/base/Checkbox.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useVersionViewport } from "@/composables/use-version-viewport.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import { translate } from "@/lib/general/translate.ts";
import Launcher from "@/lib/launcher";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

const { selected, onToggle } = defineProps<{
  "selected": Array<string>;
  "onToggle": (version: string, status: "pending" | "error" | "success") => void;
}>();

const rowSize: number = 32;
const filter = ref<"release" | "all">("release");

const { data, status, refetch } = useQuery({
  // The same query key as in 'ChangeInstanceVersionDropdown.vue'
  "queryKey": [
    "meta",
    APIEndpoints.Meta.Paths.Minecraft.Id,
    "versions",
    "do-not-reload",
    Patches.Minecraft,
  ],
  "queryFn": async (): Promise<PatchIndexType["versions"]> => (
    // For some reason, 'useQuery' makes 'data' deeply reactive...
    markRaw(await Launcher.Fetching.fetchAllVersions(Patches.Minecraft))
  ),
});

const versions = computed((): Array<string> => {
  if (status.value !== "success" || !data.value) {
    return [];
  }

  return data
    .value
    .filter(({ type }) => filter.value === "all" || type === filter.value)
    .map(({ version }) => version);
});
const { list, wrapperProps, containerProps, retry } = useVersionViewport(versions, rowSize);

function toggleFilter(): void {
  filter.value = filter.value === "release" ? "all" : "release";
}

</script>

<template>
  <div
    id="__add-instance-page__modrinth-versions"
    class="flex flex-col gap-2 rounded-md"
  >
    <div
      id="__add-instance-page__modrinth-versions-header"
      class="flex flex-nowrap items-center justify-between gap-2"
    >
      <p
        id="__add-instance-page__modrinth-versions-label"
        class="pl-1 leading-none"
      >
        Minecraft version
      </p>
      <button
        id="__add-instance-page__modrinth-versions-filter"
        class="relative min-w-16 rounded-md px-2 py-1 text-sm leading-none bg-[theme(colors.neutral.100/.1)]"
        :title="`Showing ${filter} versions`"
        @click="toggleFilter"
      >
        {{ filter }}
        <MaterialRipple />
      </button>
    </div>
    <div
      id="__add-instance-page__modrinth-versions-bound"
      class="relative w-full overflow-y-auto"
      v-bind="containerProps"
      tabindex="-1"
      style="height: 256px"
    >
      <p v-if="status === 'error'" id="__modrinth-versions-error">
        {{ translate("versions.failed") }}
        <button id="__modrinth-versions-retry" @click="retry($event, refetch)">{{ translate("general.retry") }}</button>
      </p>
      <p v-else-if="versions.length === 0" id="__modrinth-versions-status" :tabindex="status === 'success' ? -1 : undefined">
        {{ translate(status === "pending" ? "general.loading" : "versions.empty") }}
      </p>
      <div v-else id="__add-instance-page__modrinth-versions-placeholder" v-bind="wrapperProps">
        <label
          v-for="{ data: version, index } in list"
          :id="`__add-instance-page__modrinth-versions-row-${index}`"
          :key="version"
          :style="{ height: rowSize + 'px' }"
          class="__add-instance-page__modrinth-versions-item flex shrink-0 flex-nowrap cursor-pointer items-center gap-2 rounded-md p-1 text-sm hover:bg-[theme(colors.neutral.100/.05)]"
        >
          <Checkbox
            transitionless
            :id="`__add-instance-page__modrinth-versions-checkbox-${index}`"
            :aria-label="version"
            :value="selected.includes(version)"
            :on-toggle="() => onToggle(version, status)"
          />
          <span
            :id="`__add-instance-page__modrinth-versions-item-label-${index}`"
            class="truncate"
            :title="version"
          >
            {{ version }}
          </span>
        </label>
      </div>
    </div>
  </div>
</template>
