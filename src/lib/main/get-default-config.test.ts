import { expect, test, vi } from "vitest";

import type { ConfigType } from "@/lib/schemas/config/config.schema.ts";

import { getDefaultConfig } from "./get-default-config.ts";

vi.mock("@tauri-apps/api/window", async () => {
  const mockedWindow: typeof window.__TAURI__.window = {
    "getCurrentWindow": () => ({
      "theme": async () => "dark",
    }),
  } as typeof window.__TAURI__.window;

  return mockedWindow;
});

const testName = "Default Config: No arguments";

test(testName, async () => {
  const defaultConfig: ConfigType = {
    "__do_not_touch_VERSION": 1,
    "customization"         : {
      "theme"     : "dark",
      "accent"    : "rose",
      "background": "none",
    },
    "locale"               : "system",
    "minecraftWindowHeight": 480,
    "minecraftWindowWidth" : 854,
  };

  expect(
    JSON.stringify(await getDefaultConfig()),
  ).toBe(
    JSON.stringify(defaultConfig),
  );
});
