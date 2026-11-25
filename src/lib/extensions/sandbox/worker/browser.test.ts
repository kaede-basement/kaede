import { expect, test } from "bun:test";

import { browserHarness } from "../../../../../scripts/sandbox-browser/run.ts";

type TimingSample = Record<string, number>;

test("built Worker matches Ark factories and disposes listeners", async () => {
  const harness = await browserHarness();

  try {
    expect(await harness.view.evaluate("workerPermissionDelivery().catch(error => String(error))"))
      .toContain("Permission session closed");
    expect(await harness.view.evaluate("launcherContract()")).toBe(true);
    expect(await harness.view.evaluate("contract()")).toBe(true);
    expect(await harness.view.evaluate("rootContract()")).toBe(true);
    expect(await harness.view.evaluate("formEventContract()")).toBe(true);
    const counters = async (): Promise<unknown> => {
      const frames = "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))";

      await harness.view.evaluate(frames);
      await harness.view.cdp("HeapProfiler.collectGarbage");

      return harness.view.cdp("Memory.getDOMCounters");
    };

    for (const mode of ["direct", "ses", "worker"]) {
      const sample = await harness.view.evaluate<TimingSample>(`measure("${mode}", false)`);

      for (const work of ["created", "updated", "event"]) {
        expect(sample[work + "Commit"]).toBeGreaterThanOrEqual(0);
        expect(sample[work + "Frame"]).toBeGreaterThan(sample[work + "Commit"]);
      }
      const before = await counters();

      for (let cycle = 0; cycle < 5; cycle++) {
        const timing = await harness.view.evaluate<TimingSample>(`measure("${mode}", true)`);

        expect(timing.cycleCommit).toBeGreaterThanOrEqual(0);
        expect(timing.cycleFrame).toBeGreaterThan(timing.cycleCommit);
      }
      expect(await counters()).toEqual(before);
    }
  } finally {
    harness.close();
  }
}, 20_000);
