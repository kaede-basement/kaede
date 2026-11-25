import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import type { ProcessDtoType } from "@/types/application/server-process.type.ts";

import { dispatchProcessExit, ProcessHandlers, rehydrateProcesses } from "./core.ts";

test("Recover an exit that arrived while listing processes", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");

  Object.defineProperty(globalThis, "window", { "configurable": true, "value": { crypto } });
  try {
    let deliver!: (value: Array<ProcessDtoType>) => void;
    const snapshot = new Promise<Array<ProcessDtoType>>(resolve => {
      deliver = resolve;
    });

    mockIPC(() => snapshot);
    const exits: Array<string> = [];
    const attachments: Array<string> = [];
    const listed = rehydrateProcesses(handle => {
      attachments.push(handle.token);

      return {};
    }, (handle, exit) => {
      exits.push(handle.token);
      expect(exit.payload.code).toBe(7);
    });

    const exited = { "token": "test-exited", "kind": "minecraft", "pid": 1, "meta": {} };
    const running = { ...exited, "token": "test-running", "pid": 2 };

    dispatchProcessExit({ "token": exited.token, "pid": exited.pid, "code": 7, "signal": null });
    deliver([exited, running]);
    const handles = await listed;

    expect(handles.map(handle => handle.token)).toEqual([running.token]);
    expect(attachments).toEqual([running.token]);
    expect(exits).toEqual([exited.token]);
    expect(ProcessHandlers.has(exited.token)).toBe(false);
  } finally {
    ProcessHandlers.delete("test-running");
    if (original) {
      Object.defineProperty(globalThis, "window", original);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
