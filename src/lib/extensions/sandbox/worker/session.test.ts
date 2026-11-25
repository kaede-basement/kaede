import { expect, test } from "bun:test";

import { PermissionService } from "@/lib/permissions/request-permissions.ts";

import { WorkerSession } from "./session.ts";

test("disposal rejects a dedicated compartment’s pending lifecycle hook", async () => {
  const messages: string[] = [];
  let reached!: () => void;
  const requesting = new Promise<void>(resolve => {
    reached = resolve;
  });
  const worker = new Worker(new URL("runtime.ts", import.meta.url).href);
  const session = new WorkerSession(worker, (_, signal) => new Promise((_, reject) => {
    reached();
    signal.addEventListener("abort", () => reject(signal.reason), { "once": true });
  }), message => {
    if (message.kind === "log") messages.push(...message.messages);
  }, () => {});

  try {
    await session.start("example", `({
      enable() {
        scopedThis["log::write"].info(typeof postMessage, typeof document, typeof fetch);
        return requestPermissions(["log::read"]);
      },
    })`, ["log::write"]);
    const activating = session.lifecycle("enable");

    await requesting;
    session.dispose();
    session.dispose();
    await expect(activating).rejects.toThrow("disposed");
    expect(messages).toEqual(["undefined", "undefined", "undefined"]);
  } finally {
    session.dispose();
  }
});

test("a real permission prompt can outlive the lifecycle watchdog", async () => {
  const service = new PermissionService({});
  const hash = "a".repeat(64);
  const worker = new Worker(new URL("runtime.ts", import.meta.url).href);
  const session = new WorkerSession(worker, async (request, signal) => {
    if (request.kind !== "permissions") throw new Error("Unexpected request");

    return service.request(request.input, "example", hash, signal);
  }, () => {}, () => {});

  try {
    await session.start("example", "({ enable: () => requestPermissions(['time::date']) })", []);
    const enable = session.lifecycle("enable");

    await Bun.sleep(10_200);
    expect(service.answer(service.prompt.value!.id, true)).toBe(true);
    await enable;
  } finally {
    session.dispose();
    service.dispose();
  }
}, 15_000);

test("Worker startup errors reject the outstanding evaluation immediately", async () => {
  const worker = new Worker(new URL("fixtures/crash.ts", import.meta.url).href);
  const session = new WorkerSession(worker, async () => "", () => {}, () => {});

  try {
    await expect(session.start("broken", "({})", [])).rejects.toThrow();
    expect(session.lifetime.signal.aborted).toBe(true);
  } finally {
    session.dispose();
  }
}, 2000);

test("10,000 UI mutations reach the native channel in one batch", async () => {
  const lengths: number[] = [];
  const worker = new Worker(new URL("runtime.ts", import.meta.url).href);
  const session = new WorkerSession(worker, async () => "", () => {}, ops => {
    lengths.push(ops.length);
  });

  try {
    await session.start("bulk", `(() => {
      const gui = scopedThis["ui::basic"]("app");
      const root = gui.getElement("app");
      for (let i = 0; i < 10000; i++) root.appendChild(gui.createDiv());
    })()`, ["ui::basic"]);
    expect(lengths).toEqual([20_001]);
  } finally {
    session.dispose();
  }
});
