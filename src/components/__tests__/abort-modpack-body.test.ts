import "@/extendable/global-object.ts";

import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, mock, spyOn, test } from "bun:test";

import Modrinth from "@/lib/modrinth";

import { mountReleasePicker, releases } from "./modpack-fixtures.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

for (const action of ["unmount", "supersede"]) {
  test(action + " cancels a Modrinth archive body read already in progress", async () => {
    const reading = Promise.withResolvers<void>();
    const stalled = Promise.withResolvers<ArrayBuffer>();
    const drop = mock();

    mockIPC((cmd, arguments_) => {
      switch (cmd) {
        case "plugin:http|fetch": { return 1; }
        case "plugin:http|fetch_send": {
          return { "rid": 2, "status": 200, "headers": [], "url": releases[0].files[0].url };
        }
        case "plugin:http|fetch_read_body": {
          reading.resolve();

          return stalled.promise;
        }
        case "plugin:http|fetch_cancel_body": {
          drop(arguments_);
          stalled.reject(new Error("Stream closed"));
        }
      }
    });
    using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue([
      releases[0], { ...releases[1], "files": [] },
    ]);
    using next = await mountReleasePicker();
    {
      using first = await mountReleasePicker();
      await Bun.sleep(0);
      first.root.querySelector<HTMLButtonElement>("#release-id-0")!.click();
      await reading.promise;
      await Bun.sleep(0);
      expect(drop).not.toHaveBeenCalled();
      if (action === "supersede") {
        next.root.querySelector<HTMLButtonElement>("#release-id-1")!.click();
        expect(drop).toHaveBeenCalledTimes(1);
        await Bun.sleep(0);
        expect(first.root.querySelector("[role=alert]")).toBeNull();
        expect(first.root.querySelector("button")?.disabled).toBe(false);
      }
    }
    expect(drop.mock.calls).toEqual([[{ "rid": 2 }]]);
    expect(versions).toHaveBeenCalledTimes(2);
  });
}
