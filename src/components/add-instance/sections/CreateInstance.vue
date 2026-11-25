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
import { computed, inject, markRaw, ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { LaunchStatesContextKey } from "@/constants/application.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import { cancelAll } from "@/lib/launcher/scopes/fetching/cancel-all.ts";
import { log } from "@/lib/logging/log.ts";
import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";
import type {
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

const { styles } = useConfigColors();

const instanceStatuses = inject<WrappedInstanceLauncherStatusesType>(
  LaunchStatesContextKey,
);

const pending = ref<boolean>(false);
const installingId = ref<string>();
const progress = computed(() => installingId.value && instanceStatuses?.[installingId.value]);
const buttonLabel = computed(() => {
  const status = progress.value;

  return status
    ? `Cancel installation (${status.downloads.success}/${status.downloads.total} files ready)`
    : "Create an Instance";
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

function trackDownloads(instanceId: string): LauncherStatusesType {
  if (!instanceStatuses) {
    throw new Error("'instanceStatuses' is undefined");
  }

  instanceStatuses[instanceId] = {
    instanceId,
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current": markRaw(new Map<string, [number, number]>),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };

  return instanceStatuses[instanceId];
}

async function handleCreate(): Promise<void> {
  const archive = imported.value;

  const instance = currentInstance.value;
  const patch = currentPatch.value;

  if (pending.value) {
    if (installingId.value) {
      await cancelAll(`${installingId.value}-download`);
    }

    return;
  }
  if (!archive) {
    Instances.create(instance, patch);

    return;
  }

  pending.value = true;
  try {
    const id = await Instances.create(instance, patch, archive.path, async instanceId => {
      const statuses = trackDownloads(instanceId);

      installingId.value = instanceId;

      try {
        await Modrinth.installMrpack({
          "archivePath": archive.path,
          "checksum"   : instance?.checksum ?? false,
          instanceId,
          statuses,
        });
      } finally {
        if (instanceStatuses) {
          delete instanceStatuses[instanceId];
        }
      }
    });

    if (id) {
      globalStates.selected.currentInstance = id;
      globalStates.pages["add-instance"].importedModpack = undefined;
      globalStates.pages["add-instance"].lastCreated = undefined;
    }
  } catch (error: unknown) {
    const detail = typeof error === "string" ? error : Errors.prettify(error);

    log.error(__PRE_BUNDLED_FILENAME__, "Modpack installation failed", detail);
    await message(detail, { "title": "Modpack installation failed", "kind": "error" });
  } finally {
    installingId.value = undefined;
    pending.value = false;
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
      class="relative rounded-md px-2 py-1 transition-[opacity] bg-[theme(colors.neutral.100/.1)] disabled:opacity-70"
      :disabled="pending && !installingId"
      @click="handleCreate"
    >
      {{ buttonLabel }}
      <MaterialRipple :disabled="pending && !installingId" />
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
