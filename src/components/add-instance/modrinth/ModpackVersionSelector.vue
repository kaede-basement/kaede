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
import { exists, remove, rename, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { onClickOutside } from "@vueuse/core";
import { markRaw, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";

import { InstanceCreationSections } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";

const { idRoot, projectId, projectName, projectIcon, close } = defineProps<{
  "idRoot"     : string;
  "projectId"  : string;
  "projectName": string;
  "projectIcon": string | null;
  "close"      : () => void;
}>();

const container = useTemplateRef("container");

const pending = ref<boolean>(false);

const { data, status, error } = useQuery({
  "queryKey": () => [
    "modrinth",
    ModrinthAPI.ProjectType,
    projectId,
    "version",
  ],
  // For some reason, 'useQuery' makes 'data' deeply reactive...
  "queryFn": async () => markRaw(await Modrinth.fetchVersion(projectId)),
});

let generation = 0;

function invalidate(): void {
  generation++;
  pending.value = false;
}

watch(() => projectId, invalidate, { "flush": "sync" });
onBeforeUnmount(invalidate);

async function handleClick(currentEntry: NonNullable<typeof data.value>[number]): Promise<void> {
  const packURL = currentEntry?.files?.[0]?.url;

  const gameVersions = currentEntry?.game_versions;

  if (
    typeof packURL !== "string" || !packURL.trim() ||
    !Array.isArray(gameVersions) ||
    typeof gameVersions[0] !== "string" || !gameVersions[0].trim() ||
    typeof currentEntry.id !== "string" || !currentEntry.id.trim()
  ) {
    return log.error(__PRE_BUNDLED_FILENAME__, `Missing version metadata for '${projectName}'`);
  }

  const request = ++generation;

  pending.value = true;

  try {
    const response = await fetch(packURL);

    if (!response.ok) {
      throw new Error(`Fetch failed with '${response.status}'`);
    }

    const bytes = await response.bytes();

    if (request !== generation) {
      return;
    }

    const cachePath = FileManager.join(
      FileManager.getBaseDirectory(),
      FileStructure.Folders.Cache.Path,
      `modrinth-${FileManager.sanitizeFileOrFolderName(currentEntry.id)}.mrpack`,
    );

    const nonce = crypto.getRandomValues(new Uint32Array(4)).join("-");
    const temporaryPath = `${cachePath}.${nonce}.part`;
    let published = false;

    try {
      await writeFile(temporaryPath, bytes);

      if (request !== generation) {
        return;
      }

      const manifest = await Modrinth.peekMrpack(temporaryPath);

      if (!manifest || request !== generation) {
        return;
      }

      await rename(temporaryPath, cachePath);
      published = true;

      if (request !== generation) {
        return;
      }

      Modrinth.applyManifest({ manifest, "path": cachePath });
    } finally {
      if (!published && await exists(temporaryPath)) {
        await remove(temporaryPath);
      }
    }

    globalStates.pages["add-instance"]?.select?.(InstanceCreationSections[0]);

    if (projectIcon && globalStates.pages["add-instance"]?.instance) {
      globalStates.pages["add-instance"].instance.icon = projectIcon;
    }

    close();
  } catch (error: unknown) {
    log.error(__PRE_BUNDLED_FILENAME__, "Failed to open modpack:", Errors.prettify(error));
  } finally {
    if (request === generation) {
      pending.value = false;
    }
  }
}

onClickOutside(container, close);
</script>

<template>
  <div
    :id="idRoot"
    ref="container"
    class="absolute right-4 top-16 z-100 max-h-120 w-80 overflow-y-auto rounded-md bg-neutral-900 text-white"
  >
    <div
      v-if="data"
      :id="`${idRoot}-data`"
      class="w-full flex flex-col break-all text-wrap text-sm"
    >
      <button
        v-for="entry in data"
        :key="entry.id"
        :id="`${idRoot}-${entry.id}`"
        :disabled="pending"
        @click="handleClick(entry)"
        class="w-full flex flex-nowrap border-b border-neutral-600 p-2 disabled:opacity-70 hover:bg-[theme(colors.neutral.100/.1)]"
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
