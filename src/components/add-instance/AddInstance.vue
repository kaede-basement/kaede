<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { fetch } from "@tauri-apps/plugin-http";
import { inject } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { InstanceStatesContextKey } from "@/constants/application.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import Instances from "@/lib/instances";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { PatchMetaType } from "@/types/launcher/meta/patch-meta.type.ts";

const instanceStates = inject<InstanceStatesType>(InstanceStatesContextKey);

const minecraftUID: string = "net.minecraft";

const { data, status } = useQuery({
  "queryKey": ["meta", minecraftUID, "versions"],
  "queryFn" : async (): Promise<PatchMetaType> => {
    const response: Response = await fetch(APIEndpoints.Meta.Base + minecraftUID);
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

    return parsed as PatchMetaType;
  },
});

function addInstance(version: string): void {
  Instances.change(`custom-${version}`, {
    version,
    "name"        : "Minecraft (bruh)",
    "icon"        : "https://forums.terraria.org/index.php?attachments/icon-png.280655/",
    "jvmArgs"     : "",
    "windowHeight": 480,
    "windowWidth" : 854,
    "checksum"    : true,
  });
}
</script>

<template>
  <PageWrapper>
    <div id="__add-instance-page__wrapper" class="h-full flex flex-col gap-2">
      <div id="__add-instance-page__status">
        {{ status }}
      </div>
      <div id="__add-instance-page__versions-wrapper" class="grid cols-6 gap-2">
        <template v-if="data?.versions">
          <button
            v-for="entry in data.versions"
            :key="entry.version"
            :disabled="instanceStates?.[`custom-${entry.version}`] !== undefined"
            @click="() => addInstance(entry.version)"
            :id="`__add-instance-page__version-entry-${entry.version}`"
            class="h-fit flex flex-col gap-1 overflow-hidden rounded-md bg-neutral-950 p-2 text-nowrap text-xs leading-none transition-[background-color] disabled:bg-transparent hover:bg-neutral-900"
          >
            <span :id="`__add-instance-page__version-entry-type-${entry.version}`" class="text-neutral-400">
              {{ entry.type }}
            </span>
            <span :id="`__add-instance-page__version-entry-version-${entry.version}`">
              {{ entry.version }}
            </span>
          </button>
        </template>
      </div>
    </div>
  </PageWrapper>
</template>
