import { expect, test } from "bun:test";

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
