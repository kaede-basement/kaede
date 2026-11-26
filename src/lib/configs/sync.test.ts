import { mockIPC } from "@tauri-apps/api/mocks";
import { expect, test } from "bun:test";

import { withTestWindow } from "../../../scripts/setup-tests.ts";
import { getDefaultConfig } from "./scopes/get-default-config.ts";
import { createStateSync, projectConfig } from "./sync.ts";

for (const show of [true, false]) {
  test(`Zero boot writes for logs.show=${show}`, () => withTestWindow(async () => {
    const requests: Array<string> = [];

    mockIPC(cmd => {
      requests.push(cmd);
    });
    const saved = await getDefaultConfig();

    saved.logs.mode = "previous-instance";
    saved.logs.show = show;
    const current = structuredClone(saved);

    current.logs.mode = "kaede-launcher";
    const sync = createStateSync("config.json", () => saved, () => current, projectConfig);

    await sync();
    expect(requests).toEqual([]);
    current.locale = "fr";
    await sync();
    expect(requests).toEqual(["publish_text"]);
  }));
}
