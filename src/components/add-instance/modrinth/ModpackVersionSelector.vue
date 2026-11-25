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
import { writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { onClickOutside } from "@vueuse/core";
import { computed, markRaw, nextTick, ref, useTemplateRef } from "vue";

import { useModpackImport } from "@/composables/use-modpack-import.ts";
import { useVersionViewport } from "@/composables/use-version-viewport.ts";
import { InstanceCreationSections } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import { ModrinthAPI } from "@/constants/modrinth.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { translate } from "@/lib/general/translate.ts";
import Modrinth from "@/lib/modrinth";
import { releaseArchive, reserveImportArchive } from "@/lib/modrinth/import-archive.ts";
import { discardResponseBody } from "@/lib/network/discard-response-body.ts";
import { globalStates } from "@/states/global.ts";


const beginImport = useModpackImport();

const { idRoot, projectId, projectIcon, close } = defineProps<{
  "idRoot"   : string;
  "projectId": string;

  "projectIcon": string | null;
  "close"      : () => void;
}>();

const container = useTemplateRef("container");

const active = ref<() => boolean>();
const pending = computed(() => active.value?.() ?? false);
const importError = ref("");

const { data, status, error } = useQuery({
  "queryKey": [
    "modrinth",
    ModrinthAPI.ProjectType,
    projectId,
    "version",
  ],
  // For some reason, 'useQuery' makes 'data' deeply reactive...
  "queryFn": async () => markRaw(await Modrinth.fetchVersion(projectId)),
});

const releases = computed(() => data.value ?? []);
const rowHeight = 40;
const {
  list, containerProps, wrapperProps, focusFirstVisible,
} = useVersionViewport(releases, rowHeight);

async function handleClick(
  entry: (typeof releases.value)[number], event: MouseEvent,
): Promise<void> {
  const button = event.currentTarget as HTMLButtonElement;
  const document = button.ownerDocument;
  const wasFocused = document.activeElement === button;
  let written: string | undefined;
  const current = beginImport();

  active.value = current;
  importError.value = "";
  try {
    const url = (entry.files.find(file => file.primary) ?? entry.files[0])?.url;

    if (!url) {
      throw new Error(translate("import.no-url"));
    }
    const response = await fetch(url);

    if (!response.ok) {
      await discardResponseBody(response);
      throw new Error("HTTP " + response.status);
    }
    const bytes = await response.bytes();

    if (!current()) {
      return;
    }
    const hex = (bytes: Uint8Array): string => Array.from(
      bytes, byte => byte.toString(16).padStart(2, "0"),
    ).join("");
    const release = hex((new TextEncoder).encode(entry.id));
    const attempt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const archive = release + "-" + attempt + ".mrpack";
    const directory = FileManager.getBaseDirectory();
    const path = FileManager.join(directory, FileStructure.Folders.Cache.Path, archive);

    await reserveImportArchive(path);
    written = path;
    if (!current()) {
      return;
    }
    await writeFile(path, bytes, { "create": false });
    if (!current()) {
      return;
    }
    const manifest = await Modrinth.peekMrpack(path);

    if (!current()) {
      return;
    }
    if (!manifest) {
      throw new Error(translate("import.no-manifest"));
    }
    Modrinth.applyManifest({ manifest, path });
    const page = globalStates.pages["add-instance"];

    if (projectIcon && page.instance) {
      page.instance.icon = projectIcon;
    }
    close();
    page.select?.(InstanceCreationSections[0]);
  } catch (error) {
    if (current()) {
      const detail = typeof error === "string" ? error : Errors.extract(error).message;

      importError.value = translate("import.read-error") + ": " + detail;
    }
  } finally {
    releaseArchive(written);
    if (current()) {
      active.value = undefined;
      if (importError.value && wasFocused) {
        await nextTick();
        if (current() && document.activeElement === document.body) {
          focusFirstVisible();
        }
      }
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
    <p :id="`${idRoot}-import-error`" v-if="importError" role="alert" class="p-2">{{ importError }}</p>
    <div :id="`${idRoot}-viewport`" v-if="data?.length" v-bind="containerProps" tabindex="-1" class="max-h-96 overflow-y-auto">
      <div :id="`${idRoot}-rows`" v-bind="wrapperProps">
        <button
          v-for="{ data: entry } in list"
          :key="entry.id"
          :id="`${idRoot}-${entry.id}`"
          :title="entry.name"
          :disabled="pending"
          :style="{ height: rowHeight + 'px' }"
          class="w-full flex items-center gap-2 border-b border-neutral-600 p-2 text-left hover:bg-white/5 disabled:opacity-70"
          @click="handleClick(entry, $event)"
        >
          <span :id="`${idRoot}-${entry.id}-star`" class="w-6 shrink-0">{{ entry.featured ? "⭐" : "" }}</span>
          <span :id="`${idRoot}-${entry.id}-name`" class="flex-1 truncate">{{ entry.name }}</span>
          <span :id="`${idRoot}-${entry.id}-loader`" class="shrink-0 text-neutral-300">{{ entry.loaders[0] }}</span>
        </button>
      </div>
    </div>
    <p :id="`${idRoot}-empty`" v-else-if="data" class="p-2">{{ translate("versions.empty") }}</p>
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
