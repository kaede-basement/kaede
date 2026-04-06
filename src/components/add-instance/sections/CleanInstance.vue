<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { fetch } from "@tauri-apps/plugin-http";
import { computed, inject } from "vue";

import CustomInput from "@/components/general/base/CustomInput.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { GlobalStatesContextKey } from "@/constants/application.ts";
import { APIEndpoints, DefaultInstanceSettings } from "@/constants/launcher.ts";
import { InstallablePatches } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import General from "@/lib/general";
import { Pages } from "@/lib/global-state-helpers/scopes/pages.ts";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

const {} = useQuery({
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

    return parsed
      .versions
      .filter(({ type }) => type === "release");
  },
});

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const currentInstance = computed(
  (): GlobalStatesType["pages"]["states"]["add-instance"]["instance"] => {
    const storedInstance = globalStates?.pages?.states?.["add-instance"]?.instance;

    if (!storedInstance) {
      return {
        "name"         : "",
        "entry"        : "net.minecraft",
        "checksum"     : true,
        "groups"       : [],
        "javaBinary"   : "java",
        "patchVersions": { "net.minecraft": "1.16.5" },
      };
    }

    return storedInstance;
  },
);
const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

function handleNameChange(input: string): void {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not change an instance name since the instance is undefined",
    );
  }

  Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "name": input,
    },
  });
}
function handleGroup(group: string): void {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not change instance groups since the instance is undefined",
    );
  }

  const currentGroups: Set<string> = new Set(currentInstance.value.groups);

  if (currentGroups.has(group)) {
    currentGroups.delete(group);
  } else {
    currentGroups.add(group);
  }

  Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "groups": [...currentGroups],
    },
  });
}

async function handleIconPick(): Promise<void> {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not select an instance icon since the instance is undefined",
    );
  }

  const selectedIcon: string | null = await open({
    "multiple" : false,
    "directory": false,
    "title"    : "Select an instance icon",
    "filters"  : [{
      "name"      : "Image",
      "extensions": ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif", "apng"],
    }],
  });

  if (!selectedIcon) {
    return;
  }

  Pages.addToState("add-instance", {
    "instance": {
      ...currentInstance.value,
      "icon": convertFileSrc(selectedIcon),
    },
  });
}
async function createInstance(): Promise<void> {
  if (!currentInstance.value) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the instance is undefined",
    );
  }

  const randomDigits: number = Math.floor(Math.random() * 1000);
  const id: string =
    "instance_" + randomDigits + "_" +
    General.hashString(currentInstance.value.name).toString();

  await Instances.add(id, currentInstance.value);

  return Pages.navigate(Routes.Home);
}
</script>

<template>
  <div id="__add-instance-page__wrapper" class="h-fit w-full flex flex-col gap-2">
    <div
      id="__add-instance-page__instance-main-group"
      class="flex flex-nowrap gap-2"
    >
      <div
        id="__add-instance-page__instance-icon-wrapper"
        class="shrink-0 rounded-md p-2"
        :style="cardStyles"
      >
        <Image
          id="__add-instance-page__instance-icon-image"
          :src="currentInstance?.icon ?? DefaultInstanceSettings.icon"
          alt="An instance icon"
          class-names="cursor-pointer object-cover rounded-md size-22 hover:opacity-70"
          @click="handleIconPick"
        />
      </div>
      <div
        id="__add-instance-page__instance-general-wrapper"
        class="w-full flex flex-col gap-2"
      >
        <div
          id="__add-instance-page__instance-name"
          class="rounded-md p-2"
          :style="cardStyles"
        >
          <CustomInput
            icon="i-lucide-grid-2x2"
            placeholder="Instance Name"
            id-root="__add-instance-page__instance-name"
            :debounce-time="300"
            :default-value="currentInstance?.name"
            :listen-to-events="true"
            :on-input="handleNameChange"
            :class-names="{
              'wrapper': 'h-8 w-full sm:w-full',
            }"
          />
        </div>
        <div
          v-if="currentInstance?.groups"
          id="__add-instance-page__instance-groups"
          class="flex flex-nowrap gap-2 overflow-x-auto rounded-md p-2"
          :style="cardStyles"
        >
          <template v-if="currentInstance.groups.length > 0">
            <button
              v-for="group in ['vanilla', 'fabric', 'forge']"
              :id="`__add-instance-page__instance-group-${group}`"
              :key="group"
              @click="() => handleGroup(group)"
              :class="[
                '__add-instance-page__instance-group',
                'relative rounded-md px-2 py-1 transition-[background-color,color]',
                currentInstance?.groups?.includes?.(group)
                  ? 'bg-[theme(colors.neutral.100/.25)]'
                  : 'bg-neutral-800 text-neutral-400',
              ]"
            >
              <span
                :id="`__add-instance-page__instance-group-${group}-label`"
              >
                {{ group }}
              </span>
            </button>
          </template>
          <template v-else>
            <p
              id="__add-instance-page__no-groups-text"
              class="h-8 flex items-center pl-2 text-neutral-400 leading-none"
            >
              No groups...
            </p>
          </template>
        </div>
      </div>
    </div>
    <div
      id="__add-instance-page__create-instance-wrapper"
      class="w-fit rounded-md p-2"
      :style="cardStyles"
    >
      <button
        id="__add-instance-page__create-instance-button"
        class="relative rounded-md bg-neutral-800 px-2 py-1"
        @click="createInstance"
      >
        Create an Instance
        <MaterialRipple />
      </button>
    </div>
  </div>
</template>