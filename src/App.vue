<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import ExtensionLoader from "@/components/extensions/ExtensionLoader.vue";
import { provide, shallowReactive, nextTick, defineAsyncComponent } from "vue";
import Router from "@/components/layout/Router.vue";
import {
  ApplicationNamespace, ContextMenuItems,
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
import { log } from "@/lib/handlers/log.ts";
import { Command } from "@tauri-apps/plugin-shell";
import "ses";
// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from "buffer";
// import ShadowRealm from "shadowrealm-api";

const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);

(async () => {
  const url = "./assets/index-CQUR_vLf.js";
  const response = await fetch(url);
  const _code = await response.text();
  const _cleaned = _code
    .replace("<!--", "<")
    .replace("-->", ">")
    .replace("-->", ">");
  const result = await Command.create("java", [
    "--version",
  ]).execute();

  console.log(result, () => _cleaned);

  // const realm = new ShadowRealm;

  // await realm.importValue("document", "document");

  // realm.evaluate(_cleaned);

  console.log("Hardened Javascript test using SES");
  console.log(window["__core-js_shared__"]);

  const t1 = performance.now();

  try {
    console.log("Action: Trying to lockdown every JS globals");
    // lockdown({
    //   "evalTaming": "unsafeEval",
    // });
  } catch {
    console.log("Already locked down");
  }

  window.Buffer = Buffer;

  console.log("Action: Creating a safe compartment");
  const c = new Compartment({
    "globals": {
      "console" : console,
      "log"     : log,
      "document": document,
      "window"  : window,
      "location": location,
      "fetch"   : (...args: unknown[]) => fetch(args),
      Symbol,
      Uint8Array,
      Buffer,
      MathMLElement,
      HTMLElement,
      HTMLDivElement,
      global: window,
      globalThis: window,
      Date,
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
      cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
      XMLHttpRequest,
      ResizeObserver,
      "performance": window.performance,
      ElementPrototype: Element.prototype,
      HTMLElementPrototype: HTMLElement.prototype,
      NodePrototype: Node.prototype,
      EventTargetPrototype: EventTarget.prototype,
      SVGElement,
      Element,
      WebGLRenderingContext,
      WebGL2RenderingContext,
      navigator,
      Image: window.Image,
      OffscreenCanvas: window.OffscreenCanvas,
      Node: window.Node,
      EventTarget: window.EventTarget,
      HTMLCanvasElement: window.HTMLCanvasElement,
      screen,
      "dispatchEvent"      : EventTarget.prototype.dispatchEvent,
      "addEventListener"   : EventTarget.prototype.addEventListener,
      "removeEventListener": EventTarget.prototype.removeEventListener,
      HTMLCanvasElement,
      HTMLInputElement,
      CanvasRenderingContext2D,
      CanvasGradient,
      CanvasPattern,
      ImageBitmap,
      ImageData,
      TextMetrics,
      OffscreenCanvas,
      Path2D,
      ImageBitmapRenderingContext,
      "yi": {
        "__core-js_shared__": window["__core-js_shared__"],
      },
      "__core-js_shared__": window["__core-js_shared__"],
    },
    "__options__": true,
  });
  const t2 = performance.now();

  console.log("Action: Running the contained code");
  try {
    await c.evaluate(_cleaned);
  } catch (error) {
    console.error("Error in the container:", error);
  }

  const t3 = performance.now();
  console.log("Locking down & hardening done in", t2 - t1, "ms\n", "Evaluation done in", t3 - t2, "ms");
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
  "showLogs"    : false,
  "sidebarItems": RouteItems.map(item => {
    return {
      "path"  : item.Path,
      "icon"  : item.Icon,
      "name"  : capitalize(item.Path),
      "action": (): void => changeGlobalState("page", item.Path),
    };
  }),
  "contextMenuItems": [...ContextMenuItems],
});

function changeGlobalState<Key extends keyof GlobalStatesType>(key: Key, value: GlobalStatesType[Key]): void {
  log.debug(`Changing global state; key: ${key}; value: ${value}`);
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

  <Transition name="pop">
    <LogViewer v-if="globalStates.showLogs" />
  </Transition>

  <NonBundledClasses />
</template>
