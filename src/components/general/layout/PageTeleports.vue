<script setup lang="ts">
import { ref } from "vue";

import PagesSelector from "@/components/general/layout/PagesSelector.vue";
import { ApplicationNamespace } from "@/constants/application.ts";
import { Routes } from "@/constants/routes.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const teleportStates = ref<Record<
  Exclude<RouteType, "none">,
  {
    "key"  : RouteType;
    "value": string | undefined;
  }
>>({
  "profile": {
    "key"  : Routes.Profile,
    "value": undefined,
  },
  "home": {
    "key"  : Routes.Home,
    "value": undefined,
  },
  "library": {
    "key"  : Routes.Library,
    "value": undefined,
  },
  "settings": {
    "key"  : Routes.Settings,
    "value": undefined,
  },
  "add-instance": {
    "key"  : Routes.AddInstance,
    "value": undefined,
  },
});

function mountPageTo(page: Exclude<RouteType, "none">, to: string): void {
  log.debug(__PRE_BUNDLED_FILENAME__, `Mounting the '${page}' page to the '${to}' element`);
  teleportStates.value[page].value = to;
}
function unmountPage(page: Exclude<RouteType, "none">): void {
  log.debug(__PRE_BUNDLED_FILENAME__, `Unmounting the '${page}' page`);
  teleportStates.value[page].value = undefined;
}

window[ApplicationNamespace].libs.Pages.mount = mountPageTo;
window[ApplicationNamespace].libs.Pages.unmount = unmountPage;
</script>

<template>
  <template
    v-for="state in teleportStates"
    :key="`${state.key}-${state.value}`"
  >
    <Teleport v-if="state.value" :to="state.value">
      <PagesSelector :page="state.key" />
    </Teleport>
  </template>
</template>
