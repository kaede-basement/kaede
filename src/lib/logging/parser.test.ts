import { expect, test } from "bun:test";

import { parseLine } from "./parser.ts";

test("a leading space does not introduce a structured log line", () => {
  const raw = " indented | INFO | example | message";

  expect(parseLine({ raw, "index": 0 }).kind).toBe("plain");
});
