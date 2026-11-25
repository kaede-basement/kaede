import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import { readInstances } from "@/lib/instances/read-instances.ts";

import { withTestWindow } from "../../../../scripts/setup-tests.ts";
import { getAccounts } from "./get-accounts.ts";

test("malformed state requires backup", () => withTestWindow(async () => {
  const parsedFile = { "status": "corrupt", "raw": "{", "error": "invalid" } as const;

  for (const [read, privateFile] of [[getAccounts, true], [readInstances, false]] as const) {
    let publish: unknown;

    mockIPC((command, arguments_) => {
      if (command === "publish_text") publish = arguments_;
      else if (command !== "plugin:fs|mkdir") throw new Error(command);
    });
    expect(await read({ parsedFile, "baseDirectory": "base" })).toEqual(privateFile ? [] : {});
    expect(publish).toMatchObject({ "preserve": true, "private" : privateFile,
      "contents": privateFile ? "[]" : "{}" });
    mockIPC(command => {
      if (command === "publish_text") throw new Error("backup denied");
    });
    await expect(read({ parsedFile, "baseDirectory": "base" })).rejects.toThrow("backup denied");
  }
}));

test("preview publishes text through its filesystem bridge", () => withTestWindow(async () => {
  const { spyOn } = await import("bun:test");
  const { "default": browser } = await import("@/lib/browser");
  const { publishText } = await import("@/lib/file-manager/publish-text.ts");

  using detection = spyOn(browser, "detectIsBrowser").mockReturnValue(true);
  const commands: Array<string> = [];

  mockIPC(command => {
    commands.push(command);
    if (command === "plugin:fs|read_file") return new Uint8Array([255]);
    if (command === "plugin:fs|read_dir") return [];
  });
  await publishText("base/accounts.json", "[]", true, true);
  expect(detection).toHaveBeenCalled();
  expect(commands).toEqual(["plugin:fs|read_file",
    "plugin:fs|write_file",
    "plugin:fs|read_dir",
    "plugin:fs|write_text_file"]);
}));
