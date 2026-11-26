import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import English from "@/constants/english.json";
import { getMain } from "@/lib/configs/get-main.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { getTranslations } from "@/lib/configs/scopes/get-translations.ts";

import { withTestWindow } from "../../../../scripts/setup-tests.ts";

test("Repair preloaded English without rereading it", () => withTestWindow(async () => {
  const requests: Array<string> = [];

  mockIPC(cmd => {
    requests.push(cmd);
  });
  const translations = await getTranslations({
    "baseDirectory"  : "/kaede",
    "selected"       : "en",
    "preloadedConfig": { "status": "loaded", "data": { "locale": "en" } },
    "parsedFile"     : { "status": "corrupt", "raw": "{", "error": "invalid JSON" },
  });

  expect(translations).toBe(English);
  expect(requests).toEqual(["publish_text"]);
}));

test("Load English after regenerating French config", () => withTestWindow(async () => {
  const preloadedConfig = { "status": "loaded", "data": { "locale": "fr" } } as const;
  const { locale } = await getMain({ "parsedFile": preloadedConfig }, getDefaultConfig);
  const reads: Array<string> = [];

  mockIPC((cmd, arguments_) => {
    if (cmd === "plugin:fs|exists") {
      return true;
    }
    if (cmd === "plugin:fs|read_text_file" && arguments_ && "path" in arguments_) {
      reads.push(String(arguments_.path));

      return (new TextEncoder).encode(JSON.stringify(English));
    }
    throw new Error(cmd);
  });
  const translations = await getTranslations({
    "baseDirectory": "/kaede",
    "selected"     : locale,
    preloadedConfig,
    "parsedFile"   : { "status": "loaded", "data": { "Info": { "Code": "fr" } } },
  });

  expect(locale).toBe("en");
  expect(translations).toStrictEqual(English);
  expect(reads).toHaveLength(1);
  expect(reads[0]).toEndWith("en.json");
}));
