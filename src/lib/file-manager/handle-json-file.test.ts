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

test("retries a read when the cache appears after the initial miss", async () => {
  using stat = spyOn(fs, "stat").mockRejectedValue(new Error("missing"));
  using read = spyOn(fs, "readTextFile").mockRejectedValueOnce(new Error("missing"))
    .mockResolvedValueOnce("42");
  using exists = spyOn(fs, "exists").mockResolvedValue(true);
  const fetch = mock(async () => null);

  const value = await handleJsonFile({
    "baseDirectory"  : "cache",
    "path"           : ["index.json"],
    "label"          : "index",
    "getDefaultValue": fetch,
    "invalidation"   : { "days": 7, "getNewValue": fetch },
  });

  expect(value).toBe(42);
  expect(stat).toHaveBeenCalledTimes(1);
  expect(exists).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});
