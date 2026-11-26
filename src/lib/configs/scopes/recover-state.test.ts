import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, spyOn, test } from "bun:test";

import Browser from "@/lib/browser";
import { digestBytes, publishText, StateChanged } from "@/lib/file-manager/publish-text.ts";
import { readInstances } from "@/lib/instances/read-instances.ts";

import { withTestWindow } from "../../../../scripts/setup-tests.ts";
import { getAccounts } from "./get-accounts.ts";

const parsedFile = { "status": "corrupt", "raw": "{", "error": "invalid" } as const;

test("malformed state backs up the exact input", () => withTestWindow(async () => {
  for (const [read, privateFile] of [[getAccounts, true], [readInstances, false]] as const) {
    for (const input of ["{", "1.0", "9007199254740993"]) {
      const bytes = new Uint8Array((new TextEncoder).encode(input));
      const expectedHash = await digestBytes(bytes);
      let publish: unknown;

      mockIPC((command, arguments_) => {
        if (command === "plugin:fs|read_file") return bytes;
        if (command === "publish_text") publish = arguments_;
        else throw new Error(command);
      });
      const preload = input === "{" ? parsedFile : { "status": "loaded" as const,
        "data"  : JSON.parse(input) };
      const state = await read({ "parsedFile": preload, "baseDirectory": "base" });

      expect(state).toEqual(privateFile ? [] : {});
      expect(publish).toMatchObject({ expectedHash, "preserve": true, "private" : privateFile,
        "contents": privateFile ? "[]" : "{}" });
    }
    mockIPC(command => {
      if (command === "plugin:fs|read_file") return [255];
      throw new Error("backup denied");
    });
    await expect(read({ parsedFile, "baseDirectory": "base" })).rejects.toThrow("backup denied");
  }
}));

test("a recovery conflict rereads healthy BOM-prefixed state", () => withTestWindow(async () => {
  let repaired = false;
  let reads = 0;

  mockIPC(command => {
    if (command === "plugin:fs|read_file") {
      reads++;

      return (new TextEncoder).encode(repaired ? "\uFEFF{}" : "{");
    }
    if (command === "publish_text" && !repaired) {
      repaired = true;
      throw StateChanged;
    }
    throw new Error(command);
  });
  expect(await readInstances({ parsedFile, "baseDirectory": "base" })).toEqual({});
  expect(reads).toBe(2);
}));

test("preview checks raw bytes before backup", () => withTestWindow(async () => {
  using detection = spyOn(Browser, "detectIsBrowser").mockReturnValue(true);
  const commands: Array<string> = [];
  const hash = await digestBytes(new Uint8Array([255]));

  mockIPC(command => {
    commands.push(command);
    if (command === "plugin:fs|read_file") return [255];
    if (command === "plugin:fs|read_dir") return [{ "name": "accounts.json", "isFile": true }];
  });
  await expect(publishText("base/accounts.json", "[]", true, true, "stale"))
    .rejects.toThrow(StateChanged);
  expect(commands.splice(0)).toEqual(["plugin:fs|read_dir", "plugin:fs|read_file"]);
  await publishText("base/accounts.json", "[]", true, true, hash);
  expect(detection).toHaveBeenCalled();
  expect(commands).toEqual(["plugin:fs|read_dir",
    "plugin:fs|read_file",
    "plugin:fs|write_file",
    "plugin:fs|write_text_file"]);
}));

test("preview distinguishes missing keys from backups", () => withTestWindow(async () => {
  using preview = spyOn(Browser, "detectIsBrowser").mockReturnValue(true);
  const calls: Array<string> = [];

  mockIPC(command => {
    calls.push(command);
    if (command === "plugin:fs|read_file") return [];
    if (command === "plugin:fs|read_dir") {
      return [{ "name": "accounts.json.corrupt-1-2-3.bak", "isFile": true }];
    }
  });
  expect(await getAccounts({ "parsedFile": { "status": "missing" }, "baseDirectory": "base/" }))
    .toEqual([]);
  expect(calls).toContain("plugin:fs|mkdir");
  expect(calls.pop()).toBe("plugin:fs|write_text_file");
  expect(calls).not.toContain("plugin:fs|write_file");
  expect(preview).toHaveBeenCalled();
}));

test("config recovery backs up raw bytes", () => withTestWindow(async () => {
  const { regenerateConfigFile } = await import("./regenerate-config-file.ts");
  const bytes = new Uint8Array([255]);
  const expectedHash = await digestBytes(bytes);
  let saved: unknown;

  mockIPC((command, arguments_) => {
    if (command === "plugin:fs|read_file") return bytes;
    if (command === "publish_text") saved = arguments_;
    else throw new Error(command);
  });
  const config = await regenerateConfigFile({ "baseDirectory"      : "base",
    "configFileDirectory": "base/config.json" });

  expect(saved).toMatchObject({ expectedHash, "preserve": true, "path"    : "base/config.json",
    "contents": JSON.stringify(config, null, 2) });
}));
