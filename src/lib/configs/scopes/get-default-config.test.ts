import { expect, test } from "bun:test";

import { CheckConfig } from "@/lib/schemas/generated/validators.ts";

import { getDefaultConfig } from "./get-default-config.ts";

test("Default config validates and starts with safe extension and launcher settings", async () => {
  const config = await getDefaultConfig();

  expect(CheckConfig(config)).toBe(true);
  expect(config.extensions.enabled).toBe(false);
  expect(config.extensions.allowUnrestrictedUntrusted).toBe(false);
  expect(config.logs.show).toBe(false);
  expect(config.selected.currentInstance).toBeNull();
  expect(config.minecraft.javaBinary).toBe("java");
});
