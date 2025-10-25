<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ExtensionLoader from "@/components/extensions/ExtensionLoader.vue";
import { provide, shallowReactive, nextTick } from "vue";
import Router from "@/components/layout/Router.vue";
import {
  ApplicationNamespace,
  GlobalStatesChangerContextKey,
  GlobalStatesContextKey,
} from "@/constants/application.ts";
import type {
  ContextGlobalStatesType,
  GlobalStatesChangerType,
  GlobalStatesType,
} from "@/types/application/global-states.type.ts";
import { HookMappings } from "@/constants/mappings.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";
import GlobalError from "@/components/statuses/GlobalError.vue";
import ExtensionsError from "@/components/statuses/ExtensionsError.vue";
import NonBundledClasses from "@/components/misc/NonBundledClasses.vue";
import { RouteItems } from "@/constants/routes.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";

(async () => {
  if (HookMappings.page !== "onRouteChange") {
    return;
  }

  try {
    const wrapper = document.createElement("div");

    wrapper.setAttribute("id", "blue_archive");
    wrapper.setAttribute("style", "position:absolute;top:0;left:0;right:0;bottom:0");

    document.body.append(wrapper);

    const response = await fetch("./assets/index-CQUR_vLf.js");
    const code = await response.text();
    const plugin = new Function(code);

    const __globalStates = window[ApplicationNamespace].functions.getGlobalStates();

    window[ApplicationNamespace].functions.changeGlobalStates("sidebarItems", [
      ...__globalStates.sidebarItems,
      {
        "path"  : "none",
        "icon"  : "i-lucide-rss",
        "name"  : "via plugin!",
        "action": () => window[ApplicationNamespace].functions.changeGlobalStates("page", "none"),
      },
    ]);

    plugin();

    setTimeout(() => {
      const __appWrapper = document.getElementById("app_wrapper");
      const __sidebar = document.getElementById("sidebar");
      const __sidebarPlaceholder = document.getElementById("sidebar__placeholder");
      const __sidebarItems = document.getElementsByName("sidebar__item");
      const __sidebarTexts = document.getElementsByName("sidebar__item_text");

      if (__sidebar !== null && __appWrapper !== null && __sidebarPlaceholder !== null) {
        __sidebar.className = "transition-all h-58 w-16 absolute top-4 left-4 rounded-md overflow-hidden gap-2 flex flex-col bg-[theme(colors.black/.5)] p-2";
        __sidebarPlaceholder.className = "h-vh w-24 transition-[width]";

        for (const __item of __sidebarItems) {
          __item.className = "relative size-12 flex flex-col rounded-md select-none items-center justify-center gap-1 text-white transition-[width,height,background-color] duration-150 disabled:bg-[theme(colors.black/.3)]";
        }

        for (const __item of __sidebarTexts) {
          __item.className = "hidden";
        }
      }
    }, 300);
  } catch (error) {
    console.error(error);
  }
})();

const globalStates = shallowReactive<GlobalStatesType>({
  "customLayout": false,
  "page"        : "home",
  "pageStates"  : {
    "home"    : {},
    "library" : {},
    "settings": { "tab": "extensions" },
    "none"    : {},
  },
  "sidebarItems": RouteItems.map(item => {
    return {
      "path"  : item.Path,
      "icon"  : item.Icon,
      "name"  : capitalize(item.Path),
      "action": () => changeGlobalState("page", item.Path),
    };
  }),
});

function changeGlobalState<Key extends keyof GlobalStatesType>(key: Key, value: GlobalStatesType[Key]) {
  const mappedKey = HookMappings[key];

  // Global states have not changed yet
  for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].before) {
    const hook = storedFunction as (anything: unknown) => unknown;
    const { status, response } = hook(value) as {
      "status"  : ExtensionStatusType;
      "response": GlobalStatesType[Key] | undefined;
    };

    if (status === "stop") {
      if (response !== undefined) {
        globalStates[key] = response;
      }

      return;
    }
  }

  globalStates[key] = value;

  nextTick().then(async () => {
    // Global states have changed now
    for (const storedFunction of window[ApplicationNamespace].hooks[mappedKey].after) {
      const hook = storedFunction as (anything: unknown) => Promise<unknown>;

      await hook(value);
    }
  });
}

provide<ContextGlobalStatesType>(GlobalStatesContextKey, globalStates);
provide<GlobalStatesChangerType>(GlobalStatesChangerContextKey, changeGlobalState);

window[ApplicationNamespace].functions.getGlobalStates = () => globalStates;
window[ApplicationNamespace].functions.changeGlobalStates = changeGlobalState;
</script>

<template>
  <!-- Global error boundary -->
  <ErrorBoundary>
    <template #default>
      <Layout v-if="!globalStates.customLayout">
        <Router
          v-if="globalStates.page !== 'none'"
          :page="globalStates.page"
        />
      </Layout>
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <GlobalError :error="currentError" />
    </template>
  </ErrorBoundary>

  <!-- Extensions-level error boundary -->
  <ErrorBoundary>
    <template #default>
      <ExtensionLoader />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>

  <NonBundledClasses />
</template>
