import { expect, test } from "bun:test";

import { browserHarness } from "../../../../../scripts/sandbox-browser/run.ts";

test("launcher preserves activation across teardown, re-enable and engine changes", async () => {
  const harness = await browserHarness();

  try {
    expect(await harness.view.evaluate("lifecycleContract()")).toBe(true);
  } finally {
    harness.close();
  }
}, 35_000);
