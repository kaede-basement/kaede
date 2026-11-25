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
import { open } from "@tauri-apps/plugin-dialog";
import { computed, ref, shallowRef } from "vue";

import CustomButton from "@/components/general/base/CustomButton.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useModpackImport } from "@/composables/use-modpack-import.ts";
import { InstanceCreationSections } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { translate } from "@/lib/general/translate.ts";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { hashLocalArchive } from "@/lib/modrinth/import-archive.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

const beginImport = useModpackImport();

const { styles } = useConfigColors();

type ImportStatus = { "kind": "idle" | "loading" } | { "kind": "error"; "message": string };
const status = shallowRef<ImportStatus>({ "kind": "idle" });

const unsupportedPath = ref<string>();
const imported = computed(
  (): GlobalStatesType["pages"]["add-instance"]["importedModpack"] => (
    globalStates?.pages?.["add-instance"]?.importedModpack
  ),
);

const selectedPath = computed(() => imported.value?.path ?? unsupportedPath.value);
const displayedName = computed(() => (
  imported.value?.name ?? selectedPath.value?.split(/[/\\]/).pop()
));

function clearSelection(): void {
  beginImport();
  status.value = { "kind": "idle" };
  if (imported.value) {
    Instances.resetPageStates();
  }
  unsupportedPath.value = undefined;
}

async function handleImport(): Promise<void> {
  const current = beginImport();

  const loading = { "kind": "loading" } as const;

  status.value = loading;

  try {
    const selectedPath: string | null = await open({
      "multiple" : false,
      "directory": false,
      "title"    : "Select a modpack archive",
      "filters"  : [{ "name": "Modpack", "extensions": ["mrpack", "zip"] }],
    });

    if (!current() || !selectedPath) {
      return;
    }

    const sha256 = await hashLocalArchive(selectedPath);

    if (!current()) {
      return;
    }
    const manifest: MrpackManifestType | undefined =
      await Modrinth.peekMrpack(selectedPath);

    if (!current()) {
      return;
    }
    unsupportedPath.value = manifest ? undefined : selectedPath;
    Modrinth.applyManifest({ manifest, "path": selectedPath, sha256 });
    if (manifest) {
      globalStates.pages["add-instance"]?.select?.(InstanceCreationSections[0]);
    }
  } catch (error: unknown) {
    if (!current()) {
      return;
    }
    status.value = { "kind": "error", "message": Errors.prettify(error) };
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not import modpack:",
      status.value.message,
    );
  } finally {
    if (status.value === loading) {
      status.value = { "kind": "idle" };
    }
  }
}
</script>

<template>
  <div
    id="__add-instance-page__instance-import"
    class="flex flex-wrap items-center gap-2 rounded-md"
  >
    <CustomButton
      id-root="__add-instance-page__instance-import-button"
      icon="i-lucide-file-archive"
      class="w-full"
      :label="status.kind === 'loading' ? 'Loading...' : 'Import a modpack'"
      tooltip="Select a Modrinth modpack archive"
      :disabled="status.kind === 'loading'"
      :on-click="handleImport"
    />
    <div
      v-if="selectedPath"
      id="__add-instance-page__instance-import-selected"
      class="min-w-0 flex flex-1 flex-nowrap items-center gap-2 rounded-md pl-2 pr-1 leading-none"
      :title="selectedPath"
    >
      <span
        id="__add-instance-page__instance-import-selected-icon"
        :class="[
          !imported ? 'i-lucide-file-question' : 'i-lucide-package',
          'block size-4 shrink-0',
        ]"
      ></span>
      <span
        id="__add-instance-page__instance-import-selected-name"
        class="line-clamp-1 h-8 flex flex-1 items-center text-ellipsis"
      >
        {{ displayedName }}
      </span>
      <button
        id="__add-instance-page__instance-import-selected-reset"
        class="relative grid size-6 shrink-0 place-items-center rounded-md hover:bg-[theme(colors.neutral.100/.05)]"
        title="Remove the imported modpack"
        @click="clearSelection"
      >
        <span
          id="__add-instance-page__instance-import-selected-reset-icon"
          class="i-lucide-x block size-4"
        ></span>
        <MaterialRipple />
      </button>
    </div>
    <p
      v-if="unsupportedPath && !imported"
      id="__add-instance-page__instance-import-plain-zip"
      class="w-full px-1 text-sm"
      :style="styles.widgetSecondary"
    >
      {{ translate("import.no-manifest") }}
    </p>
    <p
      v-if="status.kind === 'error'"
      id="__add-instance-page__instance-import-error"
      class="w-full px-1 text-sm text-red-300"
    >
      {{ translate("import.read-error") }}: {{ status.message }}
    </p>
  </div>
</template>
