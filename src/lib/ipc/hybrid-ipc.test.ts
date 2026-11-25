import { readFileSync } from "node:fs";

import { expect, test } from "bun:test";

const script = new URL("../../../src-tauri/src/hybrid_ipc.js", import.meta.url);
const source = readFileSync(script, "utf8");

interface Batch {
  "callback": number;
  "error"   : number;
  "payload": {
    "blocked"       : boolean;
    "admissionError": number;
    "calls"         : { "cmd": string; "payload": string; "bin": boolean }[];
  };
}

interface Message {
  "cmd"     : string;
  "callback": number;
  "error"   : number;
  "payload" : unknown;
}

interface Installed {
  runCallback(id: number, value: unknown): void;
  postMessage(message: Message): void;
  ipcBatchDeliver(items: unknown[][]): void;
}

interface Transport {
  "posts"    : Batch[];
  "results"  : Map<number, unknown>;
  "callbacks": Map<number, (value: unknown) => void>;
  "installed": Installed;
  send(cmd: string, payload: unknown, callback: number): void;
}

function transport(fetcher?: (url: string, options: RequestInit) => Promise<Response>): Transport {
  const posts: Batch[] = [];
  const results = (new Map<number, unknown>);
  const callbacks = (new Map<number, (value: unknown) => void>);
  let next = 100;
  const internals = {
    "convertFileSrc": (cmd: string): string => "https://ipc.localhost/" + cmd,
    transformCallback(function_: (value: unknown) => void, once: boolean): number {
      const id = next++;

      callbacks.set(id, value => {
        if (once) callbacks.delete(id);
        function_(value);
      });

      return id;
    },
    "unregisterCallback": (id: number): boolean => callbacks.delete(id),
    runCallback(id: number, value: unknown): void {
      const callback = callbacks.get(id);

      if (callback) callback(value);
      else results.set(id, value);
    },
  };
  const window = {
    "__TAURI_INTERNALS__": internals,
    "ipc"                : {
      "postMessage": (text: string): number => posts.push(JSON.parse(text)),
    },
    get "top"(): object {
      return this;
    },
  };

  new Function("window", "fetch", "__INVOKE_KEY__", source)(window, fetcher, "key");
  const installed = internals as unknown as Installed;

  return {
    posts, results, callbacks, installed,
    send(cmd: string, payload: unknown, callback: number): void {
      installed.postMessage({ cmd, callback, "error": callback + 1, payload });
    },
  };
}

test("same-tick calls share admission and retain own __proto__ and Channel payloads", async () => {
  const ipc = transport();
  const object = JSON.parse("{\"__proto__\":{\"own\":true}}");

  await Bun.sleep(0);
  expect(ipc.posts).toHaveLength(0);
  ipc.send("first", object, 1);
  ipc.send("second", { "channel": { "__TAURI_TO_IPC_KEY__": () => "__CHANNEL__:9" } }, 3);
  await Promise.resolve();
  expect(ipc.posts).toHaveLength(1);
  const batch = ipc.posts[0];

  expect(batch.payload.calls.map(call => call.cmd)).toEqual(["first", "second"]);
  expect(batch.payload.calls[0].payload).toBe(JSON.stringify(object));
  expect(JSON.parse(batch.payload.calls[1].payload)).toEqual({ "channel": "__CHANNEL__:9" });
  ipc.installed.runCallback(batch.callback, batch.payload.admissionError);
  expect(ipc.callbacks.has(batch.error)).toBe(false);
  ipc.installed.ipcBatchDeliver([[1, object, 0], [3, [0, 255], 1]]);
  expect(Object.keys(ipc.results.get(1) as object).includes("__proto__")).toBe(true);
  expect(new Uint8Array(ipc.results.get(3) as ArrayBuffer)).toEqual(new Uint8Array([0, 255]));
  ipc.send("third", {}, 5);
  await Promise.resolve();
  expect(ipc.posts[1].callback).toBe(batch.callback);
  expect(ipc.posts[1].payload.calls[0]).not.toHaveProperty("payload");
});

test("an outer admission error rejects every member of that batch", async () => {
  const ipc = transport();

  ipc.send("one", {}, 1);
  ipc.send("two", {}, 3);
  await Promise.resolve();
  ipc.installed.runCallback(ipc.posts[0].error, "denied");
  expect([...ipc.results]).toEqual([[2, "denied"], [4, "denied"]]);
  expect(ipc.callbacks.has(ipc.posts[0].error)).toBe(false);
});

test("binary fetch flushes the queue and fences later calls", async () => {
  const requests: string[] = [];
  const finish: ((r: Response) => void)[] = [];
  const ipc = transport(url => {
    requests.push(url);

    return new Promise(resolve => finish.push(resolve));
  });

  ipc.send("first", {}, 1);
  ipc.send("binary", new Uint8Array([1]), 3);
  expect(ipc.posts[0].payload.calls.map(call => call.cmd)).toEqual(["first"]);
  ipc.send("fenced", {}, 5);
  expect(requests.map(url => new URL(url).pathname)).toEqual(["/binary", "/fenced"]);
  const headers = { "Tauri-Response": "ok", "Content-Type": "text/plain" };

  finish[0](new Response("ok", { headers }));
  await Bun.sleep(0);
  ipc.send("still-fenced", {}, 7);
  expect(requests.map(url => new URL(url).pathname))
    .toEqual(["/binary", "/fenced", "/still-fenced"]);
  finish[1](new Response("ok", { headers }));
  finish[2](new Response("ok", { headers }));
  await Bun.sleep(0);
  expect([...ipc.results.values()]).toEqual(["ok", "ok", "ok"]);
  ipc.send("after", {}, 9);
  await Promise.resolve();
  expect(ipc.posts[1].payload.calls.map(call => call.cmd)).toEqual(["after"]);
});

test("blocked protocol retries the binary view and stays on postMessage", async () => {
  let fetches = 0;
  const ipc = transport(async () => {
    fetches++;
    throw new Error("blocked");
  });

  ipc.send("bytes", new Uint8Array([1, 2, 3, 4]).subarray(1, 3), 1);
  await Bun.sleep(0);
  expect(ipc.posts[0].payload.blocked).toBe(true);
  expect(ipc.posts[0].payload.calls[0]).toMatchObject({
    "cmd": "bytes", "bin": true, "payload": "[2,3]",
  });
  ipc.send("again", new Uint8Array([9]), 3);
  await Promise.resolve();
  expect(ipc.posts[1].payload.calls[0].cmd).toBe("again");
  expect(fetches).toBe(1);
});
