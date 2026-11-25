import { expect, test } from "bun:test";

import { parsePermission } from "./parse-permission.ts";

test("internet scopes preserve IPv6 addresses and path arguments", () => {
  const raw = "internet::http-post::https://[::1]/path::name";
  const parsed = parsePermission(raw);

  expect(parsed?.base === "internet" && parsed.url.href).toBe("https://[::1]/path::name");
});

test.each([
  "time::date::garbage",
  "time::date::",
  "log::stream",
  "events::page",
  "internal-storage::read",
  "external-storage::write",
  "internet::http-get",
  "internet::http-get::file:///etc",
  "internet::http-get::https://example.com/path?key=value",
  "internet::http-get::https://example.com/path?",
  "internet::http-get::https://example.com/path#",
  "internet::http-post::https://example.com/path#anchor",
  "internet::http-get::tauri://localhost",
  "internet::http-get::javascript:void(0)",
  "unknown",
])("rejects %s", permission => {
  expect(parsePermission(permission)).toBeUndefined();
});
