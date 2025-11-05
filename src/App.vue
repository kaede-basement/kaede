<script setup lang="ts">
import Layout from "@/components/layout/Layout.vue";
import Router from "@/components/layout/Router.vue";
import ErrorBoundary from "@/components/handlers/ErrorBoundary.vue";
import GlobalError from "@/components/statuses/GlobalError.vue";
import ExtensionsError from "@/components/statuses/ExtensionsError.vue";
import NonBundledClasses from "@/components/misc/NonBundledClasses.vue";
import { defineAsyncComponent, nextTick, provide, shallowReactive } from "vue";
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
import { RouteItems } from "@/constants/routes.ts";
import { capitalize } from "@/lib/helpers/capitalize.ts";
import { log } from "@/lib/handlers/log.ts";

const LogViewer = defineAsyncComponent(
  () => import("@/components/logging/LogViewer.vue"),
);
const ExtensionLoader = defineAsyncComponent(
  () => import("@/components/extensions/ExtensionLoader.vue"),
);

/*
(async () => {
  if (!localStorage.getItem("CH0304_home.skel")) {
    localStorage.setItem("CH0304_home.skel", String.raw`{"SettingModel":{"version":5,"skel":"CH0304_home.skel","atlas":"CH0304_home.atlas","eyeTouch":"Touch_Me","idol":"Idle_01","x":459,"y":693,"scale":0.34,"angle":0,"bgmVolume":0.1,"talkVolume":0.45,"showTouch":false,"panelDisplay":false,"showTalkDialog":false,"textX":767,"textY":382,"textSize":16,"autoTalk":0,"resolution":"2k","startAnimation":"Start_Idle_01","startScene":true,"language":"中文"},"EventInfos":[{"BoneName":"Spine_03","Width":1500,"Height":800,"Animations":["Talk_01_M","Talk_02_M","Talk_03_M","Talk_04_M","Talk_05_M"],"AnimationIndex":10,"TextIndex":0,"ClickType":"click","EmptyAnimation":true},{"BoneName":"front hat_03b","Width":800,"Height":500,"Animations":["Pat_01_M"],"AnimationIndex":20,"TextIndex":0,"ClickType":"pointerdown","EmptyAnimation":false}],"AnimationsTexts":{"中文":{"CH0304_MemorialLobby_1_1":"……我想起了第一次拿起画笔的那天。","CH0304_MemorialLobby_1_2":"那时……我单纯地、笔直地面对着画布。","CH0304_MemorialLobby_2_1":"现在的我……已经不一样了。","CH0304_MemorialLobby_2_2":"不知道该画什么，失去了自信……","CH0304_MemorialLobby_3_1":"就在那时，老师告诉了我。","CH0304_MemorialLobby_3_2":"「名为『梦想』的魔法，早已寄宿在你的心里。」","CH0304_MemorialLobby_4_1":"只要还有梦想……接下来就不会在道路上迷失了吧。","CH0304_MemorialLobby_4_2":"老师……如果可以的话，愿意和我一起走这条路吗？","CH0304_MemorialLobby_5":"一条用五彩缤纷的梦想铺成的魔法之路！"},"日本語":{"CH0304_MemorialLobby_1_1":"……はじめて絵を描いた日を、思い出します。","CH0304_MemorialLobby_1_2":"あのときは……まっすぐ、純粋に、キャンバスと向き合っていました。","CH0304_MemorialLobby_2_1":"今の私は……違います。","CH0304_MemorialLobby_2_2":"何を描けばいいのか分からなくなって、自信を失ってしまって……。","CH0304_MemorialLobby_3_1":"そんなとき、マスターが教えてくれたんです。","CH0304_MemorialLobby_3_2":"「夢」という魔法は、もう心の中に宿ってるって。","CH0304_MemorialLobby_4_1":"夢があるなら……これからは、道に迷わずに済みそうです。","CH0304_MemorialLobby_4_2":"マスター……よければ、私と同じ道を歩みませんか？","CH0304_MemorialLobby_5":"色とりどりの夢でいっぱいの、魔法の道を！"},"English":{"CH0304_MemorialLobby_1_1":"...I remember the first day I ever picked up a brush.","CH0304_MemorialLobby_1_2":"Back then... I faced the canvas straight on, with pure heart.","CH0304_MemorialLobby_2_1":"But now... I’m not the same.","CH0304_MemorialLobby_2_2":"I no longer know what to paint, and I’ve lost my confidence...","CH0304_MemorialLobby_3_1":"At that moment, Master told me:","CH0304_MemorialLobby_3_2":"“The magic called ‘dream’ has already taken root inside your heart.”","CH0304_MemorialLobby_4_1":"As long as I have that dream... I won’t lose my way anymore.","CH0304_MemorialLobby_4_2":"Master... if you’d like, would you walk this same path with me?","CH0304_MemorialLobby_5":"A magical road paved with countless, colorful dreams!"},"Tiếng Việt":{"CH0304_MemorialLobby_1_1":".....Em vẫn nhớ ngày đầu tiên, mình bắt đầu vẽ tranh.","CH0304_MemorialLobby_1_2":"Lúc đó.. Em đối diện với khuôn canvas... \nTheo cách chân thành và thuần khiết nhất.","CH0304_MemorialLobby_2_1":"Còn em bây giờ... khác nhiều rồi.","CH0304_MemorialLobby_2_2":"Khi cầm cọ lên, em không biết nên vẽ gì nữa. \nEm mất tự tin về chính bản thân mình.","CH0304_MemorialLobby_3_1":"Và chính khi ấy, \nMaster lại dạy cho em một bài học","CH0304_MemorialLobby_3_2":"“Về phép màu mang tên ''Giấc mơ''.. \nVẫn luôn trú ngụ trong trái tim chúng ta ấy.”","CH0304_MemorialLobby_4_1":"Miễn còn có Giấc mơ... Thì từ giờ trở đi... \nEm không phải lo mình lạc l4_MemorialLobby_4_2":"Master... Nếu người không ngại thì... Hãy cùng em đi chung một lối nhé?","Cối nữa.","CH030H0304_MemorialLobby_5":"Trên con đường ma thuật, Ngập tràn những giấc mơ muôn màu!"}}}`);
  }

  const url = "./assets/index-CQUR_vLf.js";
  const response = await fetch(url);
  const _code = await response.text();
  const _cleaned = _code;
    //.replace("<!--", "<")
    //.replace("-->", ">")
    //.replace("-->", ">");
  const result = await Command.create("java", [
    "--version",
  ]).execute();

 */

  // console.log(result, /* () => _cleaned */);

  /*

  // const realm = new ShadowRealm;

  // await realm.importValue("document", "document");

  // realm.evaluate(_cleaned);

  console.log("Hardened Javascript test using SES");

  const t1 = performance.now();

  try {
    console.log("Action: Trying to lockdown every JS globals");
    // lockdown({
    //   "evalTaming": "unsafeEval",
    // });
  } catch {
    console.log("Already locked down");
  }

  // window.Buffer = Buffer;

   */
  /*
  const _temporary: object = {};

  for (const _name of Object.getOwnPropertyNames(window)) {
    if (["Infinity", "undefined", "NaN"].includes(_name)) {
      continue;
    }

    if (_name[0] === _name[0].toLowerCase() && typeof window[_name] === "function") {
      _temporary[_name] = window[_name].bind(window);

      continue;
    }

    _temporary[_name] = window[_name];
  }

  console.log("Action: Creating a safe compartment");
  const c = new Compartment({
    "globals": _temporary, {
      ...window,
      "console": {
        ...console,
        "log": log.debug,
        ...log,
      },
      "log"     : log,
      "document": window.document,
      "globalThis": window,
      "location": window.location,
      "Symbol": window.Symbol,
      "Buffer": window.Buffer,
      "MathMLElement": window.MathMLElement,
      "HTMLElement": window.HTMLElement,
      "HTMLDivElement": window.HTMLDivElement,
      "Response": window.Response,
      "TouchEvent": window.TouchEvent,
      "MouseEvent": window.MouseEvent,
      "PointerEvent": window.PointerEvent,
      "global": window,
      "window": window,
      "Date": window.Date,
      "requestAnimationFrame": window.requestAnimationFrame.bind(window),
      "cancelAnimationFrame": window.cancelAnimationFrame.bind(window),
      "XMLHttpRequest": window.XMLHttpRequest,
      "ResizeObserver": window.ResizeObserver,
      "performance": window.performance,
      "ElementPrototype": Element.prototype,
      "HTMLElementPrototype": HTMLElement.prototype,
      "NodePrototype": Node.prototype,
      "EventTargetPrototype": EventTarget.prototype,
      "SVGElement": window.SVGElement,
      "Element": window.Element,
      "WebGLRenderingContext": window.WebGLRenderingContext,
      "WebGL2RenderingContext": window.WebGL2RenderingContext,
      "navigator": window.navigator,
      "Image": window.Image,
      "OffscreenCanvas": window.OffscreenCanvas,
      "Node": window.Node,
      "EventTarget": window.EventTarget,
      "HTMLCanvasElement": window.HTMLCanvasElement,
      "screen": window.screen,
      "fonts": window.document.fonts,
      "dispatchEvent"      : window.dispatchEvent.bind(window),
      "addEventListener"   : window.addEventListener.bind(window),
      "removeEventListener": window.removeEventListener.bind(window),
      "HTMLInputElement": window.HTMLInputElement,
      "CanvasRenderingContext2D": window.CanvasRenderingContext2D,
      "CanvasGradient": window.CanvasGradient,
      "CanvasPattern": window.CanvasPattern,
      "ImageData": window.ImageData,
      "TextMetrics": window.TextMetrics,
      "Path2D": window.Path2D,
      "ImageBitmapRenderingContext": window.ImageBitmapRenderingContext,
      "__core-js_shared__": window["__core-js_shared__"],
      "fetch"   : (...args: [RequestInfo]) => fetch(...args),
      "ImageBitmap": window.ImageBitmap,
      HTMLImageElement: window.HTMLImageElement,
      HTMLVideoElement: window.HTMLVideoElement,
      Blob: window.Blob,
      File: window.File,
      ArrayBuffer: window.ArrayBuffer,
      Uint8Array: window.Uint8Array,
      Int8Array: window.Int8Array,
      Uint8ClampedArray: window.Uint8ClampedArray,
      Uint16Array: window.Uint16Array,
      "Int16Array": window.Int16Array,
      Uint32Array: window.Uint32Array,
      Int32Array: window.Int32Array,
      Float32Array: window.Float32Array,
      DataView: window.DataView,
      XMLDocument: window.XMLDocument,
      "Math": window.Math,
      URL: {
        ...window.URL,
        createObjectURL: URL.createObjectURL.bind(URL),
        revokeObjectURL: URL.revokeObjectURL.bind(URL),
      },
      createImageBitmap: window.createImageBitmap.bind(window),
      setInterval: window.setInterval.bind(window),
      setTimeout: window.setTimeout.bind(window),
      clearInterval: window.clearInterval.bind(window),
      clearTimeout: window.clearTimeout.bind(window),
      FontFace: window.FontFace,
    },
    "__options__": true,
  });
  */
  /*
  const t2 = performance.now();

  console.log("Action: Running the contained code");
  try {
    // await c.evaluate(_cleaned);
    eval(_cleaned);
  } catch (error) {
    console.error("Error in the container:", error);
  }

  log.debug("Initializing launcher");
  await initializeLauncher().catch((error: unknown) => {
    log.error("Failed to initialize launcher:", JSON.stringify(error));
  });

  const t3 = performance.now();
  console.log("Locking down & hardening done in", t2 - t1, "ms\n", "Secure ECMAScript evaluation done in", t3 - t2, "ms");

  // const __invoke = window.__TAURI_INTERNALS__.invoke.bind(window.__TAURI_INTERNALS__); // or `{}`?
  // console.log(window.__TAURI_INTERNALS__);

  // window.__TAURI_INTERNALS__.invoke = (): void => {};

  console.log("Evaluating...");
  log.debug("Evaluating...");
  (new Function(`
    console.log(window.__TAURI_INTERNALS__);
    window.__TAURI_INTERNALS__.invoke("plugin:log|log", {
      level: 4,
      message: 'Wow!',
      location: '',
      file: '',
      line: 1,
      keyValues: { "": "" }
    })
  `))();
})();
   */

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
      <Layout v-if="!globalStates.customLayout" :page="globalStates.page">
        <Router
          v-if="globalStates.page !== 'none'"
          :page="globalStates.page"
        />

        <Transition name="pop">
          <LogViewer v-if="globalStates.showLogs" />
        </Transition>

        <NonBundledClasses />
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
      <ExtensionLoader v-if="false" />
    </template>

    <!-- In case of an error, show this template -->
    <template #error="{ currentError }">
      <ExtensionsError :error="currentError" />
    </template>
  </ErrorBoundary>
</template>
