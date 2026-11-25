import * as webviews from "@tauri-apps/api/webviewWindow";
import { expect, mock, spyOn, test } from "bun:test";

import { recreateWebView } from "./recreate-web-view.ts";

test("hard reload retries after creation and destruction failures", async () => {
  const destroy = mock(async () => {}).mockRejectedValueOnce(new Error("old window busy"));
  const cleanup = mock(async () => {});
  let event = "tauri://error";
  const replacement = {
    "destroy": cleanup,
    "once"   : async (name: string, callback: (error?: Error) => void): Promise<void> => {
      if (name === event) {
        callback(new Error("creation failed"));
      }
    },
  } as unknown as webviews.WebviewWindow;

  using current = spyOn(webviews, "getCurrentWebviewWindow")
    .mockReturnValue({ destroy, "label": "main" } as unknown as webviews.WebviewWindow);
  const constructors = webviews as unknown as { "WebviewWindow": () => webviews.WebviewWindow };

  using create = spyOn(constructors, "WebviewWindow").mockReturnValue(replacement);

  await expect(recreateWebView()).rejects.toThrow("creation failed");
  event = "tauri://created";
  await expect(recreateWebView()).rejects.toThrow("old window busy");
  expect(cleanup).toHaveBeenCalledTimes(1);
  await recreateWebView();
  expect(current).toHaveBeenCalledTimes(3);
  expect(create).toHaveBeenCalledTimes(3);
});
