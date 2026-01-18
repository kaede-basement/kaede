<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { fetch } from "@tauri-apps/plugin-http";
import { computed, inject, ref } from "vue";

import CleanInstance from "@/components/add-instance/sections/CleanInstance.vue";
import Image from "@/components/general/base/Image.vue";
import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { GlobalStatesContextKey, InstanceCreationSections } from "@/constants/application.ts";
import { APIEndpoints } from "@/constants/launcher.ts";
import General from "@/lib/general";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const selected = ref<string>(InstanceCreationSections[0].id);

const cardStyles = computed(
  (): ReturnType<typeof General.getSidebarInnerStyles> => (
    General.getSidebarInnerStyles(
      globalStates?.layout?.sidebar?.background,
      globalStates?.layout?.sidebar?.color,
      globalStates?.layout?.sidebar?.blur,
    )
  ),
);

useQuery({
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

function handleModeSelect(id: string): void {
  selected.value = id;
}
</script>

<template>
  <PageWrapper>
    <div
      id="__add-instance-page__wrapper"
      class="h-full w-full flex flex-wrap gap-2 py-2 pr-2 sm:flex-nowrap"
    >
      <div
        id="__add-instance-page__type-selector"
        class="h-fit w-full flex flex-col gap-2 rounded-md p-2 sm:w-fit"
        :style="cardStyles"
      >
        <button
          v-for="mode in InstanceCreationSections"
          :key="mode.id"
          :disabled="selected === mode.id"
          @click="() => mode?.action?.(mode.id) ?? handleModeSelect(mode.id)"
          :id="`__add-instance-page__type-selector-item-${mode.id}`"
          class="__add-instance-page__type-selector-item relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color] duration-150 disabled:bg-[theme(colors.neutral.100/.1)] hover:bg-[theme(colors.neutral.100/.05)]"
        >
          <Image
            :id="`__add-instance-page__type-selector-image-${mode.id}`"
            :src="mode.image"
            :alt="`An icon of the '${mode.name}' instance mode selector`"
            class-names="size-6"
          />
          <span
            :id="`__add-instance-page__type-selector-item-label-${mode.id}`"
          >
            {{ mode.name }}
          </span>
          <MaterialRipple />
        </button>
      </div>
      <CleanInstance v-if="selected === 'clean-minecraft'" />
    </div>
  </PageWrapper>
</template>
