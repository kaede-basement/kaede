import { expect, mock, test } from "bun:test";

const created = mock(() => {});

mock.module("@tauri-apps/api/webviewWindow", () => ({
  "WebviewWindow": class {
    constructor() {
      created();
    }

    async once(event: string, callback: (payload: Error) => void): Promise<void> {
      if (event === "tauri://error") {
        callback(new Error("creation failed"));
      }
    }
  },
}));

const { recreateWebView } = await import("./recreate-web-view.ts");

test("a creation error allows another hard reload attempt", async () => {
  await expect(recreateWebView()).rejects.toThrow("creation failed");
  await expect(recreateWebView()).rejects.toThrow("creation failed");
  expect(created).toHaveBeenCalledTimes(2);
});
