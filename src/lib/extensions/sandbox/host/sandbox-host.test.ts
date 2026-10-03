/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { expect, test } from "bun:test";

import {
  createSandboxHost,
  type SandboxHostMethodType,
  type SandboxHostType,
  SandboxLimitError,
  type SandboxPortType,
} from "@/lib/extensions/sandbox/host/sandbox-host.ts";

type FakeSandboxType = {
  "host"      : SandboxHostType;
  "sent"      : Array<unknown>;
  "receive"   : (data: unknown, ports?: Array<unknown>) => void;
  "terminated": Array<string>;
  "killed"    : () => boolean;
  "calls"     : Array<unknown>;
};

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function createFakeSandbox(
  methods: Record<string, SandboxHostMethodType> = {},
  messageBytes: number = 1024,
): FakeSandboxType {
  const sent: Array<unknown> = [];
  const terminated: Array<string> = [];
  const calls: Array<unknown> = [];
  let listener: ((event: MessageEvent<unknown>) => void) | undefined;
  let killed: boolean = false;
  const port = {
    "addEventListener": (type: string, handler: (event: MessageEvent<unknown>) => void) => {
      if (type === "message") {
        listener = handler;
      }
    },
    "start"      : () => {},
    "close"      : () => {},
    "postMessage": (message: unknown) => sent.push(message),
  } as unknown as SandboxPortType;
  const host = createSandboxHost({
    "id"     : "test",
    port,
    "methods": {
      "echo": { "kind": "request", "handle": parameters => parameters },
      "ping": { "kind": "notify", "handle": parameters => calls.push(parameters) },
      ...methods,
    },
    messageBytes,
    "terminateWorker": () => {
      killed = true;
    },
    "onTerminated": reason => terminated.push(reason),
  });

  return {
    host,
    sent,
    terminated,
    calls,
    "killed" : () => killed,
    "receive": (data, ports = []) => (
      listener?.({ data, ports } as unknown as MessageEvent<unknown>)
    ),
  };
}

test("Sandbox Host: answers a known request", async () => {
  const sandbox = createFakeSandbox();

  sandbox.receive({ "kind": "request", "id": 1, "method": "echo", "parameters": { "a": 1 } });
  await flush();

  expect(sandbox.sent).toEqual([{ "kind": "response", "id": 1, "ok": true, "value": { "a": 1 } }]);
});

test("Sandbox Host: rejects unknown methods and kind mismatches", async () => {
  const sandbox = createFakeSandbox();

  sandbox.receive({ "kind": "request", "id": 1, "method": "fetch", "parameters": {} });
  sandbox.receive({ "kind": "request", "id": 2, "method": "ping", "parameters": {} });
  sandbox.receive({ "kind": "notify", "method": "echo", "parameters": {} });
  sandbox.receive({ "kind": "request", "id": 3, "method": "toString", "parameters": {} });
  await flush();

  expect(sandbox.sent).toEqual([
    { "kind": "response", "id": 1, "ok": false, "error": "Unknown method 'fetch'" },
    { "kind": "response", "id": 2, "ok": false, "error": "Unknown method 'ping'" },
    { "kind": "response", "id": 3, "ok": false, "error": "Unknown method 'toString'" },
  ]);
  expect(sandbox.calls).toEqual([]);
  expect(sandbox.host.isTerminated()).toBe(false);
});

test("Sandbox Host: ignores malformed messages without terminating", async () => {
  const sandbox = createFakeSandbox();
  const cyclic: Record<string, unknown> = { "kind": "notify", "method": "ping" };

  cyclic.parameters = cyclic;

  sandbox.receive(null);
  sandbox.receive("ping");
  sandbox.receive({ "kind": "notify", "method": "ping", "parameters": (new Map) });
  sandbox.receive({ "kind": "request", "id": -1, "method": "echo", "parameters": {} });
  sandbox.receive({ "kind": "request", "id": 1.5, "method": "echo", "parameters": {} });
  sandbox.receive(cyclic);
  sandbox.receive({ "kind": "notify", "method": "ping", "parameters": 1 }, [{}]);
  await flush();

  expect(sandbox.sent).toEqual([]);
  expect(sandbox.calls).toEqual([]);
  expect(sandbox.host.isTerminated()).toBe(false);
});

test("Sandbox Host: terminates the plugin when a message is too large", () => {
  const sandbox = createFakeSandbox({}, 64);

  sandbox.receive({ "kind": "notify", "method": "ping", "parameters": "x".repeat(64) });

  expect(sandbox.host.isTerminated()).toBe(true);
  expect(sandbox.killed()).toBe(true);
  expect(sandbox.terminated).toHaveLength(1);
  expect(sandbox.calls).toEqual([]);
});

test("Sandbox Host: counts the holes of a sparse array toward the message size", async () => {
  const sandbox = createFakeSandbox();
  const operations: Array<unknown> = [];

  operations.length = 50_000;
  sandbox.receive(structuredClone({
    "kind"      : "notify",
    "method"    : "ping",
    "parameters": { operations },
  }));
  await flush();

  expect(sandbox.host.isTerminated()).toBe(true);
  expect(sandbox.calls).toEqual([]);
});

test("Sandbox Host: terminates the plugin when a handler reports an exceeded limit", async () => {
  const sandbox = createFakeSandbox({
    "grow": {
      "kind"  : "notify",
      "handle": () => {
        throw new SandboxLimitError("too many nodes");
      },
    },
  });

  sandbox.receive({ "kind": "notify", "method": "grow", "parameters": {} });
  await flush();

  expect(sandbox.terminated).toEqual(["too many nodes"]);
});

test("Sandbox Host: settles requests from the response", async () => {
  const sandbox = createFakeSandbox();
  const pending = sandbox.host.request("lifecycle", { "hook": "enable" }, 1000);

  expect(sandbox.sent).toEqual([
    { "kind": "request", "id": 1, "method": "lifecycle", "parameters": { "hook": "enable" } },
  ]);

  sandbox.receive({ "kind": "response", "id": 1, "ok": false, "error": "boom" });

  await expect(pending).rejects.toThrow("boom");
  expect(sandbox.host.isTerminated()).toBe(false);
});

test("Sandbox Host: a timed out request terminates the plugin", async () => {
  const sandbox = createFakeSandbox();
  const pending = sandbox.host.request("lifecycle", { "hook": "disable" }, 5);
  const other = sandbox.host.request("lifecycle", { "hook": "enable" }, 1000);

  const [timedOut, cancelled] = await Promise.allSettled([pending, other]);

  expect(timedOut.status === "rejected" && String(timedOut.reason)).toContain("did not finish");
  expect(cancelled.status === "rejected" && String(cancelled.reason)).toContain("terminated");

  expect(sandbox.killed()).toBe(true);
  expect(sandbox.terminated).toEqual(["'lifecycle' did not finish in 5 ms"]);
  await expect(sandbox.host.request("lifecycle", {}, 5)).rejects.toThrow("terminated");

  // Nothing is processed after termination
  sandbox.receive({ "kind": "notify", "method": "ping", "parameters": 1 });
  expect(sandbox.calls).toEqual([]);
});
