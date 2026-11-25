import * as webviews from "@tauri-apps/api/webviewWindow";
import { expect, mock, spyOn, test } from "bun:test";

import { recreateWebView } from "./recreate-web-view.ts";

test("hard reload cleans up a surviving replacement before opening another", async () => {
  const live = new Set(["main"]);
  const destroy = mock(async () => {
    live.delete("main");
  })
    .mockRejectedValueOnce(new Error("old window busy"));
  const cleanup = mock(async (label: string) => {
    live.delete(label);
  })
    .mockRejectedValueOnce(new Error("cleanup failed"));
  let event = "tauri://error";

  using current = spyOn(webviews, "getCurrentWebviewWindow")
    .mockReturnValue({ destroy, "label": "main" } as unknown as webviews.WebviewWindow);
  const constructors = webviews as unknown as {
    "WebviewWindow": (label: string) => webviews.WebviewWindow;
  };

  using create = spyOn(constructors, "WebviewWindow").mockImplementation(label => {
    expect([...live]).toEqual(["main"]);

    return {
      "destroy": () => cleanup(label),
      "once"   : async (name: string, callback: (error?: Error) => void): Promise<void> => {
        if (name === event) {
          if (event === "tauri://created") {
            live.add(label);
          }
          callback(new Error("creation failed"));
        }
      },
    } as unknown as webviews.WebviewWindow;
  });

  await expect(recreateWebView()).rejects.toThrow("creation failed");
  event = "tauri://created";
  await expect(recreateWebView()).rejects.toThrow("old window busy");
  expect(live.size).toBe(2);
  await recreateWebView();
  const labels = create.mock.calls.map(([label]) => label);

  expect(current).toHaveBeenCalledTimes(3);
  expect(new Set(labels).size).toBe(3);
  expect(cleanup.mock.calls).toEqual([[labels[1]], [labels[1]]]);
  expect([...live]).toEqual([labels[2]]);
});
