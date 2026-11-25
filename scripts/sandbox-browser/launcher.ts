import { mockIPC } from "@tauri-apps/api/mocks";

import { DefaultGlobalStatesPagesStates } from "@/bootstrap/application.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { GlobalObject } from "@/extendable/global-object.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { setExtensionEnabled, startExtensionSession } from "@/lib/extensions/dirty-lifecycle.ts";
import { runInSandbox } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { runInWorker } from "@/lib/extensions/sandbox/run-in-worker.ts";
import { PermissionService, permissionSession } from "@/lib/permissions/request-permissions.ts";
import { extensionStates } from "@/states/extension.ts";
import { declareGlobalStates, globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

mockIPC(command => {
  if (command !== "plugin:log|log") throw new Error("Unexpected native call " + command);
});
window.__KAEDE__ = GlobalObject;
GlobalInternals.initialConfig = await getDefaultConfig();
declareGlobalStates(DefaultGlobalStatesPagesStates);
globalStates.extensions.enabled = true;
let now = 0;
const service = new PermissionService(globalStates.extensions.permissions, () => now);

permissionSession.value = service;

type Hook = () => void | Promise<void>;
export type Hooks = Record<"enable" | "disable" | "afterDisable", Hook> & { "dispose": () => void };
export async function artifact(
  code: string, permissions: ExtensionType["metadata"]["permissions"] = ["ui::interactivity"],
): Promise<ExtensionType> {
  const metadata: ExtensionType["metadata"] = {
    "name"      : "benchmark",
    "version"   : "1",
    "type"      : "sandbox",
    permissions,
    "authors"   : [],
    "source"    : "",
    "categories": [],
    "languages" : [],
    "logo"      : "",

  };
  const encoder = new TextEncoder;
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(code));
  const framed = new Blob([new Uint8Array(1), JSON.stringify(metadata), new Uint8Array(1), bytes]);
  const digest = await crypto.subtle.digest("SHA-256", await framed.arrayBuffer());
  const hex = (buffer: ArrayBuffer): string => Array.from(
    new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0"),
  ).join("");

  return {
    code, metadata, "id": "benchmark", "codeSha256": hex(bytes), "artifactSha256": hex(digest),
  };
}

export async function sandbox(mode: string, code: string): Promise<Hooks> {
  return runSandbox(mode, await artifact(code));
}

export async function runSandbox(mode: string, extension: ExtensionType): Promise<Hooks> {
  const lifetime = new AbortController;
  const hooks = mode === "worker" ? await runInWorker(extension, lifetime)
    : runInSandbox({ ...extension, "permissions": extension.metadata.permissions, lifetime });

  if (!hooks) throw new Error("Sandbox initialization failed");

  return { ...hooks, "dispose": () => lifetime.abort() };
}

export async function workerPermissionDelivery(): Promise<void> {
  const extension = await artifact("({ enable: () => requestPermissions(['time::date']) })", []);
  const origin = new PermissionService({
    [`artifact/${extension.artifactSha256}`]: {
      get "time::date"(): boolean {
        // Close after the handler receives its cached decision, before the Worker reply.
        queueMicrotask(() => queueMicrotask(() => origin.dispose()));

        return true;
      },
    },
  });

  permissionSession.value = origin;
  const lifetime = new AbortController;

  try {
    const hooks = await runInWorker(extension, lifetime);

    permissionSession.value = service;
    await hooks.enable();
  } finally {
    lifetime.abort();
    origin.dispose();
    permissionSession.value = service;
  }
}

function visible(): boolean {
  const frame = document.querySelector("iframe");

  return frame?.contentDocument?.querySelector("span")?.textContent === "number";
}

export async function launcherContract(): Promise<boolean> {
  const stop = startExtensionSession();
  const url = location.origin + "/echo";
  const permission = `internet::http-post::${url}` as const;
  const extension = await artifact(`(() => {
    if ([typeof fetch, typeof document, typeof postMessage].some(v => v !== "undefined")) {
      throw Error("Ambient authority");
    }
    const gui = scopedThis["ui::interactivity"]("app");
    const span = gui.createSpan();
    gui.getElement("app").appendChild(span);
    requestPermissions(["time::date"]).then(async ([time]) => {
      const bytes = new Uint8Array([0, 42, 255]);
      const fetch = scopedThis[${JSON.stringify(permission)}].webFetch;
      const response = await fetch(${JSON.stringify(url)}, bytes);
      const received = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== 3 || received.join() !== bytes.join()) throw Error("Binary transfer");
      try {
        await fetch(${JSON.stringify(url)}, "", "text/html");
      } catch {
        span.setText(typeof time.Date.now());
      }
    });
    return {};
  })()`, ["ui::interactivity", permission]);

  globalStates.extensions.list.push({
    "enabled": true, "sha256": extension.artifactSha256, "label": "test",
  });
  const setting = globalStates.extensions.list[0];

  extensionStates.valid = [extension];
  const delay = (): Promise<void> => new Promise<void>(resolve => setTimeout(resolve, 5));
  let previous: HTMLIFrameElement | null = null;

  try {
    await setExtensionEnabled(extension, true, setting);
    for (const engine of ["ses", "worker", "ses"] as const) {
      if ((globalStates.extensions.sandboxEngine ?? "ses") !== engine) {
        globalStates.extensions.sandboxEngine = engine;
      }
      if (engine === "ses" && service.prompt.value) {
        now += 5000;
        service.answer(service.prompt.value.id, true);
      }
      for (let index = 0; index < 200; index++) {
        if (visible() && document.querySelector("iframe") !== previous) break;
        await delay();
      }
      if (!visible() || previous?.isConnected) {
        throw new Error("Missing artifact grant in " + engine);
      }
      if (service.prompt.value || extensionStates.executed.length !== 1) {
        throw new Error("Unexpected lifecycle state");
      }
      previous = document.querySelector("iframe");
    }

    await setExtensionEnabled(extension, false, setting);
    if (document.querySelector("iframe") || extensionStates.executed.length > 0) {
      throw new Error("Sandbox survived disable");
    }

    return true;
  } finally {
    stop();
  }
}
