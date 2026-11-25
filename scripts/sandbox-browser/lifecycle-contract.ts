import { nextTick } from "vue";

import { setExtensionEnabled, startExtensionSession } from "@/lib/extensions/dirty-lifecycle.ts";
import { permissionSession } from "@/lib/permissions/request-permissions.ts";
import { extensionStates } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";

import { artifact, sandbox } from "./launcher.ts";

const frame = (): HTMLIFrameElement | null => document.querySelector("iframe");

const root = (): HTMLElement => frame()!.contentDocument!.getElementById("app")!;

async function until(label: string, predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 12_000;

  while (!predicate()) {
    if (performance.now() >= deadline) {
      throw new Error(label + ": " + frame()?.contentDocument?.body.textContent);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

const plugin = (action: string): string => `(() => {
    const gui = scopedThis["ui::interactivity"]("app");
    const root = gui.getElement("app");
    root.setText(${JSON.stringify(action)});
    return {
      enable() { root.setText("enabled"); },
      disable() {
        switch (root.getText()) {
          case "throw": throw Error("Outgoing hook failed");
          case "hang": return new Promise(() => {});
          case "prompt": return requestPermissions(["log::read"]);
        }
      },
      afterDisable() { root.setText("cleaned"); }
    };
  })()`;

async function executionContract(): Promise<void> {
  for (const mode of ["ses", "worker"]) {
    const api = await sandbox(mode, `(() => {
      const gui = scopedThis["ui::interactivity"]("app");
      const root = gui.getElement("app");
      const button = gui.createButton();
      root.appendChild(button);
      button.onClick(() => { throw Error("Listener failed"); });
      button.onClick(() => button.setText("clicked"));
      const hooks = Object.assign(new Promise(() => {}), {
        verify() { if (this !== hooks) throw Error("Lost hook receiver"); },
        enable() { this.verify(); }, disable() { this.verify(); }, afterDisable() { this.verify(); }
      });
      return hooks;
    })()`);

    try {
      await api.enable();
      const button = frame()!.contentDocument!.querySelector("button")!;

      button.click();
      await until(mode + " second listener", () => button.textContent === "clicked");
      await api.disable();
      await api.afterDisable();
    } finally {
      api.dispose();
    }
  }
}

export async function lifecycleContract(): Promise<boolean> {
  await executionContract();
  let stop = startExtensionSession();
  const extension = await artifact(plugin("loaded"));
  const setting = { "sha256": extension.artifactSha256, "label": "hooks", "enabled": true };

  extensionStates.valid = [extension];
  globalStates.extensions.list = [setting];
  try {
    await setExtensionEnabled(extension, true, setting);
    const first = root();

    if (first.textContent !== "loaded") throw new Error("Initial activation changed");
    await setExtensionEnabled(extension, false, setting);
    if (first.textContent !== "cleaned") throw new Error("Missing afterDisable");
    await setExtensionEnabled(extension, true, setting);
    if (root().textContent !== "enabled") throw new Error("Missing re-enable hook");
    const second = root();

    globalStates.extensions.sandboxEngine = "worker";
    await until("replacing SES", () => (
      frame()?.contentDocument?.body.textContent === "enabled" && root() !== second
    ));
    if (second.textContent !== "cleaned") throw new Error("Missing outgoing afterDisable");
    const workerRoot = root();

    globalStates.extensions.sandboxEngine = "ses";
    await until("replacing Worker", () => (
      frame()?.contentDocument?.body.textContent === "enabled" && root() !== workerRoot
    ));
    const beforeUnsupported = frame();
    const descriptor = Object.getOwnPropertyDescriptor(window, "FinalizationRegistry")!;

    Object.defineProperty(window, "FinalizationRegistry", { ...descriptor, "value": undefined });
    try {
      globalStates.extensions.sandboxEngine = "worker";
      await nextTick();
      if (frame() !== beforeUnsupported || !setting.enabled) throw new Error("Lost working SES");
      if ((globalStates.extensions.sandboxEngine as string) !== "ses") {
        throw new Error("Unavailable engine remained selected");
      }
      await setExtensionEnabled(extension, false, setting);
      stop();
      globalStates.extensions.sandboxEngine = "worker";
      stop = startExtensionSession();
      setting.enabled = true;
      await setExtensionEnabled(extension, "restore", setting);
      if (!setting.enabled || root().textContent !== "loaded" ||
        (globalStates.extensions.sandboxEngine as string) !== "ses") {
        throw new Error("Unavailable Worker failed to restore in SES");
      }
    } finally {
      Object.defineProperty(window, "FinalizationRegistry", descriptor);
    }
    await setExtensionEnabled(extension, false, setting);

    for (const action of ["throw", "prompt", "hang"]) {
      const engine = action === "hang" ? "ses" : "worker";

      globalStates.extensions.sandboxEngine = engine;
      const outgoing = await artifact(plugin(action));
      const entry = { "sha256": outgoing.artifactSha256, "label": action, "enabled": true };

      globalStates.extensions.list = [entry];
      extensionStates.valid = [outgoing];
      await setExtensionEnabled(outgoing, true, entry);
      const old = frame();

      globalStates.extensions.sandboxEngine = engine === "ses" ? "worker" : "ses";
      if (action === "prompt") {
        await until(action + " start", () => !!permissionSession.value?.prompt.value);
      }
      await until(action, () => !!frame() && frame() !== old && root().textContent === "enabled");
      if (!entry.enabled || permissionSession.value?.prompt.value) {
        throw new Error("Lost activation");
      }
      await setExtensionEnabled(outgoing, false, entry);
    }

    return true;
  } finally {
    stop();
  }
}
