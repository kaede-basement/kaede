<script setup lang="ts">
import { computed, inject } from "vue";

import { ApplicationNamespace, GlobalStatesContextKey } from "@/constants/application.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";
import type { AtAGlanceType } from "@/types/ui/at-a-glance.type.ts";

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const currentGlance = computed((): AtAGlanceType => {
  const configGlance: {
    "title"   : string | null | undefined;
    "subtitle": string | null | undefined;
  } = {
    "title"   : globalStates?.layout?.atAGlance?.title,
    "subtitle": globalStates?.layout?.atAGlance?.subtitle,
  };

  if (!configGlance.title || !configGlance.subtitle) {
    log.debug("No custom 'At a Glance' text in the config, using defaults");
    const currentTitle = window[ApplicationNamespace].__internals.atAGlance?.title;
    const newAtAGlance = General.getAtAGlance(currentTitle);

    window[ApplicationNamespace].__internals.atAGlance = newAtAGlance;

    return newAtAGlance;
  }

  log.debug("Showing a custom 'At a Glance' text:", JSON.stringify(
    configGlance,
    null,
    2,
  ));

  return {
    "title"   : configGlance.title,
    "subtitle": configGlance.subtitle,
  };
});
</script>

<template>
  <div
    id="__home-page__header-wrapper"
    class="flex flex-col gap-1 pt-4"
  >
    <div
      id="__home-page__header-title"
      class="w-fit cursor-pointer border border-transparent rounded-md p-2 text-3xl leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      {{ currentGlance.title }}
    </div>
    <div
      id="__home-page__header-subtitle"
      class="w-fit cursor-pointer border border-transparent rounded-md p-2 text-lg text-neutral-300 leading-none transition-[background-color,border-color] hover:border-[theme(colors.white/.3)] hover:bg-[theme(colors.white/.1)]"
    >
      {{ currentGlance.subtitle }}
    </div>
  </div>
</template>
