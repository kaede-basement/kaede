import { runInSandbox } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { runInWorker } from "@/lib/extensions/sandbox/run-in-worker.ts";

import { artifact } from "./launcher.ts";

export async function fetchContract(origin: string): Promise<boolean> {
  const permission = `internet::http-get::${origin}` as const;
  const extension = await artifact(`(() => {
    const scope = scopedThis[${JSON.stringify(permission)}];
    const url = ${JSON.stringify(origin)};
    let dynamic, write, pending;
    return {
      async enable() {
        [dynamic, write] = await requestPermissions([${JSON.stringify(permission)}, "log::write"]);
        write.info("active");
        const response = await scope.webFetch(url + "stream");
        if (response.status !== 201 || !response.ok || response.url !== url + "stream"
          || response.headers.get("x-contract") !== "stream") throw Error("Missing HTTP metadata");
        await dynamic.webFetch(url + "finish");
        if ((await response.json()).hello !== "world") throw Error("Wrong JSON");
        try { await response.blob(); } catch { return; }
        throw Error("Read the same body twice");
      },
      async disable() {
        const response = await dynamic.webFetch(url + "stream");
        pending = response.text().then(() => false, () => true);
      },
      async afterDisable() {
        const stale = [() => scope.webFetch(url + "unexpected"),
          () => dynamic.webFetch(url + "unexpected"),
          () => scopedThis["log::write"].info("stale"), () => write.info("stale")];
        for (const call of stale) {
          try { await call(); } catch { continue; }
          throw Error("Inactive grant still works");
        }
        if (!await pending) throw Error("Disposed fetch delivered a body");
      },
    };
  })()`, [permission, "log::write"]);

  for (const mode of ["worker", "ses"]) {
    const lifetime = new AbortController;

    if (mode === "ses") {
      Object.defineProperties(lifetime.signal, {
        "throwIfAborted": { "value": undefined }, "reason": { "value": undefined },
      });
    }
    const hooks = mode === "worker" ? await runInWorker(extension, lifetime) : runInSandbox({
      ...extension, "permissions": extension.metadata.permissions, lifetime,
    });

    if (!hooks) throw new Error("Missing sandbox");
    try {
      await hooks.enable();
      await hooks.disable();
      lifetime.abort();
      if (mode === "ses") await hooks.afterDisable();
    } finally {
      lifetime.abort();
    }
  }

  return true;
}

export async function abandonedFetchContract(
  origin: string, mode: string,
): Promise<() => Promise<void>> {
  const permission = `internet::http-get::${origin}` as const;
  const extension = await artifact(`(() => {
    const { webFetch } = scopedThis[${JSON.stringify(permission)}];
    const origin = ${JSON.stringify(origin)};
    let read, held;
    return {
      async enable() {
        if ((await webFetch(origin + "discard")).status !== 200) throw Error("Missing status");
        read = (await webFetch(origin + "read")).text;
        held = await webFetch(origin + "dispose");
      },
      async disable() {
        if (await read() !== "retained" || held.status !== 200) throw Error("Lost live body");
      },
    };
  })()`, [permission]);
  const lifetime = new AbortController;
  const hooks = mode === "worker" ? await runInWorker(extension, lifetime) : runInSandbox({
    ...extension, "permissions": extension.metadata.permissions, lifetime,
  });

  if (!hooks) throw new Error("Missing sandbox");
  await hooks.enable();

  return async (): Promise<void> => {
    try {
      await hooks.disable();
    } finally {
      lifetime.abort();
    }
  };
}
