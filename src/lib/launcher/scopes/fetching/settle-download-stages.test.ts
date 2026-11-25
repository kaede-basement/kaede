import { expect, mock, test } from "bun:test";

import { settleDownloadStages } from "./settle-download-stages.ts";

test("cancels on failure and waits for sibling writes before reporting the error", async () => {
  let finish!: () => void;
  const writer = new Promise<void>(resolve => {
    finish = resolve;
  });
  const events: Array<string> = [];

  const cancel = mock(async () => {
    events.push("cancel");
    finish();

    return true;
  });

  await expect(settleDownloadStages(cancel, [
    async (): Promise<boolean> => {
      throw new Error("extract failed");
    },
    async (): Promise<boolean> => false,
    async (): Promise<boolean> => {
      await writer;
      await Bun.sleep(1);
      events.push("write finished");

      return true;
    },
  ])).rejects.toThrow("extract failed");

  expect(events).toEqual(["cancel", "write finished"]);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(await settleDownloadStages(cancel, [async (): Promise<boolean> => false])).toBe(false);
});
