<script setup lang="ts">
import { onClickOutside, useDebounceFn } from "@vueuse/core";
import { computed, nextTick, ref, useTemplateRef } from "vue";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import Configs from "@/lib/configs";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { AtAGlanceType } from "@/types/misc/at-a-glance.type.ts";

const target = useTemplateRef<HTMLDivElement>("target");

const editing = ref<keyof AtAGlanceType | undefined>(undefined);

const currentGlance = computed((): AtAGlanceType => {
  const configGlance: {
    "title"   : string | null | undefined;
    "subtitle": string | null | undefined;
  } = {
    "title"   : globalStates?.layout?.atAGlance?.title,
    "subtitle": globalStates?.layout?.atAGlance?.subtitle,
  };

  if (!configGlance.title || !configGlance.subtitle) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "No custom 'At a Glance' text in the config, using defaults",
    );
    const currentTitle = GlobalInternals.atAGlance?.title;
    const newAtAGlance = General.getAtAGlance(currentTitle);

    GlobalInternals.atAGlance = newAtAGlance;

    return newAtAGlance;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.json.contents(
    "Showing a custom 'At a Glance' text",
    configGlance,
  ));

  return {
    "title"   : configGlance.title,
    "subtitle": configGlance.subtitle,
  };
});

const handleEdit = useDebounceFn(async (event: Event): Promise<void> => {
  const target = event?.target as HTMLInputElement;
  const value = target?.value;
  const key: keyof AtAGlanceType | undefined = editing.value;

  if (!key || !value || !globalStates) {
    return;
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Setting the global 'At a Glance - ${key}' value to: ${value}`,
  );
  GlobalStateHelpers.change("layout", {
    ...globalStates.layout,
    "atAGlance": {
      ...currentGlance.value,
      [key]: value,
    },
  });

  // Vue batches state changes
  await nextTick();
  // Global states have changed, now we can sync the config file
  await Configs.sync();
}, 300);

onClickOutside(target, () => {
  editing.value = undefined;
});
</script>

<template>
  <div
    id="__home-page__header-wrapper"
    ref="target"
    class="flex flex-col gap-1 pt-4"
  >
    <div
      id="__home-page__header-title"
      @click="() => editing = 'title'"
      class="relative w-fit cursor-pointer break-all border border-transparent rounded-md p-2 text-3xl leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      <p id="__home-page__header-title-text" class="whitespace-pre-wrap">
        {{ currentGlance.title }}
      </p>
      <Transition name="pop">
        <input
          v-if="editing === 'title'"
          autocomplete="off"
          id="__home-page__header-title-editor-wrapper"
          class="absolute left-0 top-13 z-10 rounded-md bg-neutral-950 p-1 text-lg leading-none outline-none focus:outline-none"
          :value="currentGlance.title"
          @input="handleEdit"
      />
      </Transition>
    </div>
    <div
      id="__home-page__header-subtitle"
      @click="() => editing = 'subtitle'"
      class="relative w-fit cursor-pointer break-all border border-transparent rounded-md p-2 text-lg text-neutral-300 leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      <p id="__home-page__header-subtitle-text" class="whitespace-pre-wrap">
        {{ currentGlance.subtitle }}
      </p>
      <Transition name="pop">
        <input
          v-if="editing === 'subtitle'"
          autocomplete="off"
          id="__home-page__header-title-editor-wrapper"
          class="absolute left-0 top-10 z-10 rounded-md bg-neutral-950 p-1 text-lg leading-none outline-none focus:outline-none"
          :value="currentGlance.subtitle"
          @input="handleEdit"
        />
      </Transition>
    </div>
  </div>
</template>
