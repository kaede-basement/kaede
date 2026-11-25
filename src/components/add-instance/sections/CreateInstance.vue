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
import { message } from "@tauri-apps/plugin-dialog";
import { computed } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/log.ts";
import { installArchive } from "@/lib/modrinth/install-mrpack.ts";
import { globalStates } from "@/states/global.ts";
import { ActiveInstall, beginInstall, finishInstall } from "@/states/instance-operation.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const { styles } = useConfigColors();

const buttonLabel = computed(() => {
  const install = ActiveInstall.value;

  if (!install) return "Create an Instance";
  if (!install.cancel) return "Saving instance...";
  const { success, total } = install.statuses.downloads;

  return `Cancel installation (${success}/${total} files ready)`;
});

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
const currentPatch = computed((): ExtendedPatchUIDType => (
  currentVersionSearch.value?.patch ?? Patches.Minecraft
));
const imported = computed(
  (): GlobalStatesType["pages"]["add-instance"]["importedModpack"] => (
    globalStates?.pages?.["add-instance"]?.importedModpack
  ),
);

async function handleCreate(): Promise<void> {
  const archive = imported.value;

  const instance = currentInstance.value;
  const patch = currentPatch.value;

  if (ActiveInstall.value) {
    await ActiveInstall.value.cancel?.();

    return;
  }
  if (!archive) {
    Instances.create(instance, patch);

    return;
  }

  let install: ReturnType<typeof beginInstall> | undefined;

  try {
    await Instances.create(instance, patch, archive.path, async instanceId => {
      install = beginInstall(instanceId);
      await installArchive(archive.path, install);
    });
  } catch (error: unknown) {
    if (error === "Installation cancelled") {
      await message(error, { "title": "Modpack installation", "kind": "info" });

      return;
    }
    const detail = typeof error === "string" ? error : Errors.prettify(error);

    log.error(__PRE_BUNDLED_FILENAME__, "Modpack installation failed", detail);
    await message(detail, { "title": "Modpack installation failed", "kind": "error" });
  } finally {
    if (install) finishInstall(install);
  }
}
</script>

<template>
  <div
    id="__add-instance-page__create-instance-wrapper"
    class="w-fit flex flex-nowrap gap-2 rounded-md p-2"
  >
    <button
      id="__add-instance-page__create-instance-button"
      class="relative rounded-md px-2 py-1 transition-[opacity] bg-[theme(colors.neutral.100/.1)]"
      :disabled="!!ActiveInstall && !ActiveInstall.cancel"
      @click="handleCreate"
    >
      {{ buttonLabel }}
      <MaterialRipple />
    </button>
    <div
      id="__add-instance-page__create-instance-type-display"
      class="py-1 pr-2"
      :style="styles.widgetSecondary"
    >
      with {{ PrettyPatchLabels[currentPatch] }}
      <span
        v-if="
          globalStates.pages['add-instance'].importedModpack &&
          globalStates.pages['add-instance'].importedModpack.loader === currentPatch
        "
        id="__add-instance-page__create-instance-type-display-imported"
        :style="{ 'color': styles.widget.color }"
      >
        ({{ globalStates.pages["add-instance"].importedModpack.name }})
      </span>
    </div>
  </div>
</template>
