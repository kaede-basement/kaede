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
function handlePatch(uid: string): void {
  console.log(uid);
}
function createInstance(): void {
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

  Instances.add(id, currentInstance.value);
}
</script>

<template>
  <div id="__add-instance-page__wrapper" class="h-fit w-full flex flex-col gap-2">
    <div
      id="__add-instance-page__instance-main-group"
      class="flex flex-wrap gap-2 sm:flex-nowrap"
    >
      <div
        id="__add-instance-page__instance-icon-wrapper"
        class="flex flex-nowrap gap-2 rounded-md p-2"
        :style="cardStyles"
      >
        <Image
          id="__add-instance-page__instance-icon-image"
          :src="currentInstance?.icon ?? DefaultInstanceSettings.icon"
          alt="An instance icon"
          class-names="cursor-pointer object-cover rounded-md size-24 hover:opacity-70"
          @click="handleIconPick"
        />
      </div>
    </div>
    <div
      id="__add-instance-page__instance-name"
      class="flex flex-nowrap items-center gap-4 rounded-md px-4 py-2"
      :style="cardStyles"
    >
      <label
        id="__add-instance-page__instance-name-label"
        for="__add-instance-page__instance-name-input"
        class="cursor-pointer text-neutral-300"
      >
        Instance Name
      </label>
      <CustomInput
        icon="i-lucide-type"
        placeholder="hii"
        id-root="__add-instance-page__instance-name"
        class="h-8"
        :debounce-time="200"
        :default-value="'hii'"
        :listen-to-events="true"
        :on-input="() => {}"
        :on-escape="() => {}"
      />
    </div>
    <button
      v-for="patch in InstallablePatches"
      :key="patch.uid"
      @click="() => patch?.action?.(patch.uid) ?? handlePatch(patch.uid)"
      :id="`__add-instance-page__item-${patch.id}`"
      class="__add-instance-page__item rounded-md p-2 hover:bg-neutral-800"
      :style="cardStyles"
    >
      <span
        :id="`__add-instance-page__item-inner-${patch.id}`"
        class="relative h-full flex flex-col items-center justify-center gap-4 rounded-md p-4 transition-[background-color] duration-150 hover:bg-[theme(colors.neutral.100/.05)]"
      >
         <Image
           v-if="patch.icon"
           :id="`__add-instance-page__item-icon-${patch.id}`"
           :src="patch.icon"
           :alt="`An icon of the '${patch.uid}' patch`"
           class-names="rounded-md size-12"
         />
        <span :id="`__add-instance-page__item-${patch.id}`" class="block break-all">
          {{ patch.name }}
        </span>
        <MaterialRipple />
      </span>
    </button>
  </div>
</template>