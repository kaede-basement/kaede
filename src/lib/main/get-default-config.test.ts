import { expect, test, vi } from "vitest";
import { getDefaultConfig } from "./get-default-config.ts";
import type { ConfigType } from "@/types/config/config.schema.ts";

vi.mock("@tauri-apps/api/window", async () => {
  return {
    "getCurrentWindow": () => ({
      "theme": async () => "dark",
    }),
  };
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
