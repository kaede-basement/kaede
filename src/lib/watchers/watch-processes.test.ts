import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import { withTestWindow } from "../../../scripts/setup-tests.ts";
import { watchProcesses } from "./watch-processes.ts";

test("Retry only the listener whose unlisten rejected", () => withTestWindow(async () => {
  const released: Array<string> = [];
  let fail = true;

  mockIPC((cmd, arguments_) => {
    if (!arguments_ || !("event" in arguments_)) {
      throw new Error(cmd);
    }
    const event = String(arguments_.event);

    if (cmd === "plugin:event|listen") {
      return 1;
    }
    released.push(event);
    if (event === "process-error" && fail) {
      throw new Error("busy");
    }
  });
  const stop = await watchProcesses();

  try {
    await stop();
    expect(released).toEqual(["process-output", "process-exited", "process-error"]);
    fail = false;
    await stop();
    expect(released.slice(3)).toEqual(["process-error"]);
    const reattached = await watchProcesses();

    expect(reattached).not.toBe(stop);
    await reattached();
    expect(released.slice(4)).toEqual(["process-output", "process-exited", "process-error"]);
  } finally {
    fail = false;
    await stop();
  }
}));
