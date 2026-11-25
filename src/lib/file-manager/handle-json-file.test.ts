import * as fs from "@tauri-apps/plugin-fs";
import { expect, mock, spyOn, test } from "bun:test";

import { handleJsonFile } from "./handle-json-file.ts";

test("a failed default provider is invoked only once", async () => {
  using read = spyOn(fs, "readTextFile").mockResolvedValue("invalid JSON");
  const getDefaultValue = mock(async () => {
    throw new Error("fetch failed");
  });

  await expect(handleJsonFile({
    "baseDirectory": "cache", "path": ["index.json"], "label": "index", getDefaultValue,
  })).rejects.toThrow("fetch failed");
  expect(read).toHaveBeenCalledTimes(1);
  expect(getDefaultValue).toHaveBeenCalledTimes(1);
});

test("reads a cache published after a stat miss", async () => {
  using stat = spyOn(fs, "stat").mockRejectedValue(new Error("not found"));
  using read = spyOn(fs, "readTextFile").mockResolvedValue("{\"published\":true}");
  const fetch = mock(async () => null);

  expect(await handleJsonFile({
    "baseDirectory"  : "cache",
    "path"           : ["index.json"],
    "label"          : "index",
    "getDefaultValue": fetch,
    "invalidation"   : { "days": 7, "getNewValue": fetch },
  })).toEqual({ "published": true });
  expect(stat).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
