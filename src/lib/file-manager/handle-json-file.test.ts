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
