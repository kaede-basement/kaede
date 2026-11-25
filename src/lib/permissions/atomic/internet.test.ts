import { expect, test } from "bun:test";

import { fetchWithinScope, guardRequestUrl, validateContentType } from "../internet-scope.ts";

test("scope requires HTTP(S), the same origin, and a complete path segment", () => {
  const scope = new URL("https://example.com/scope");

  expect(() => guardRequestUrl("https://example.com/scope/path", scope)).not.toThrow();
  for (const url of ["https://example.com/scoped", "https://other.com/scope", "file:///scope"]) {
    expect(() => guardRequestUrl(url, scope)).toThrow();
  }
  expect(() => guardRequestUrl("file:///scope", new URL("tauri://localhost/scope"))).toThrow();
});

test("transport receives the absolute URL that passed the scope check", async () => {
  const scope = new URL("https://example.com/scope");
  let received: string | undefined;

  await fetchWithinScope(async href => {
    received = href;

    return (new Response);
  }, "https:EXAMPLE.com:443/scope/path", scope, {});
  expect(received).toBe("https://example.com/scope/path");
});

test("content types allow a single UTF-8 charset parameter", () => {
  expect(validateContentType("\u00A0APPLICATION/JSON; charset=UTF-8\u00A0")).toBe(
    "application/json; charset=utf-8",
  );
  for (const value of ["text/html", "text/plain;boundary=x", "text/plain;charset=utf-8;other=x"]) {
    expect(() => validateContentType(value)).toThrow();
  }
});
