import { expect, test } from "bun:test";

import { browserHarness } from "../../../../../scripts/sandbox-browser/run.ts";

test("both sandboxes expose headers before the body and revoke effects on disposal", async () => {
  let cancellations = 0;
  let bothCancelled!: () => void;
  const cancelled = new Promise<void>(resolve => {
    bothCancelled = resolve;
  });
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const server = Bun.serve({
    "hostname": "127.0.0.1", "port": 0,
    fetch(request) {
      const headers = {
        "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "x-contract",
      };

      if (new URL(request.url).pathname === "/finish" && stream) {
        stream.enqueue((new TextEncoder).encode("\"world\"}"));
        stream.close();
        stream = undefined;

        return new Response(null, { "status": 204, headers });
      }
      if (new URL(request.url).pathname !== "/stream") throw new Error("Unexpected fetch");
      const body = new ReadableStream<Uint8Array>({
        start(controller): void {
          stream = controller;
          controller.enqueue((new TextEncoder).encode("{\"hello\":"));
        },
        cancel(): void {
          if (++cancellations === 2) bothCancelled();
        },
      });

      return new Response(body, {
        "status": 201, "headers": { ...headers, "x-contract": "stream" },
      });
    },
  });

  try {
    const harness = await browserHarness();

    try {
      const code = `fetchContract(${JSON.stringify(server.url.href)})`;
      const result = await harness.view.evaluate(code);

      expect(result).toBe(true);
      await cancelled;
    } finally {
      harness.close();
    }
  } finally {
    server.stop(true);
  }
}, 12_000);

test("discarded responses release their streams while each sandbox stays active", async () => {
  let closed = Promise.withResolvers<string>();
  const server = Bun.serve({
    "idleTimeout": 0,
    "hostname"   : "127.0.0.1", "port"       : 0,
    fetch(request) {
      const headers = { "Access-Control-Allow-Origin": "*" };
      const path = new URL(request.url).pathname;

      if (path === "/read") return new Response("retained", { headers });

      return new Response(new ReadableStream<Uint8Array>({
        start(controller): void {
          controller.enqueue(new Uint8Array([1]));
        },
        cancel(): void {
          closed.resolve(path);
        },
      }), { headers });
    },
  });

  try {
    const { view, close } = await browserHarness();

    try {
      let workerSession: string | undefined;

      const events: EventTarget = view;

      events.addEventListener("Target.attachedToTarget", event => {
        const { data } = event as MessageEvent<{
          "targetInfo": { "type": string }; "sessionId": string;
        }>;

        if (data.targetInfo.type === "worker") workerSession = data.sessionId;
      });
      await view.cdp("Target.setAutoAttach", {
        "autoAttach": true, "waitForDebuggerOnStart": false, "flatten": false,
      });
      for (const mode of ["ses", "worker"]) {
        closed = Promise.withResolvers<string>();
        const url = JSON.stringify(server.url.href);

        await view.evaluate(`(async () => {
          window.finishFetch = await abandonedFetchContract(${url}, "${mode}");
        })()`);
        if (mode === "worker") {
          if (!workerSession) throw new Error("Worker inspector unavailable");
          await view.cdp("Target.sendMessageToTarget", {
            "sessionId": workerSession,
            "message"  : JSON.stringify({ "id": 1, "method": "HeapProfiler.collectGarbage" }),
          });
        } else {
          await view.cdp("HeapProfiler.collectGarbage");
        }
        expect(await closed.promise).toBe("/discard");
        closed = Promise.withResolvers<string>();
        await view.evaluate("window.finishFetch()");
        expect(await closed.promise).toBe("/dispose");
      }
    } finally {
      close();
    }
  } finally {
    server.stop(true);
  }
}, 15_000);
