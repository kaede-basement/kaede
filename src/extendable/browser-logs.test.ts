import { expect, test } from "bun:test";
import { reactive, watch } from "vue";

import { BrowserLogs, GlobalInternals } from "./global-internals.ts";

test("browser log replacement and chunked appends retain absolute line indexes", () => {
  GlobalInternals.logsInBrowser = Array.from({ "length": 5000 }, (_, index) => String(index));
  const logs = GlobalInternals.logsInBrowser;

  logs.push("5000");
  expect(logs.length).toBeLessThanOrEqual(5000);
  expect(logs[0]).toBe(String(BrowserLogs.value.dropped));
  logs[0] = "edited";
  expect(GlobalInternals.logsInBrowser[0]).toBe("edited");
  GlobalInternals.logsInBrowser = ["new"];
  expect(BrowserLogs.value.dropped).toBe(0);
  expect([...GlobalInternals.logsInBrowser]).toEqual(["new"]);
});

for (const reactiveAlias of [false, true]) {
  test(`retained array updates the log viewer (reactive: ${reactiveAlias})`, async () => {
    const raw = Array.from({ "length": 5000 }, (_, index) => String(index));
    const lines = reactiveAlias ? reactive(raw) : raw;

    GlobalInternals.logsInBrowser = lines;
    let notifications = 0;
    const stop = watch(BrowserLogs, () => {
      notifications++;
    }, { "flush": "sync" });

    try {
      lines.push("next");
      expect(lines[0]).toBe(String(BrowserLogs.value.dropped));
      await Promise.resolve();
      expect(notifications).toBe(1);
      lines.unshift(...Array.from({ "length": 501 }, () => "header"));
      expect(lines).toHaveLength(4500);
      expect(BrowserLogs.value.dropped).toBe(1002);
      lines.splice(0, 1, "replacement");
      await Promise.resolve();
      expect(BrowserLogs.value.list[0]).toBe("replacement");
      expect(notifications).toBe(2);
      GlobalInternals.logsInBrowser = [];
      expect(lines).toHaveLength(4500);
    } finally {
      stop();
    }
  });
}
