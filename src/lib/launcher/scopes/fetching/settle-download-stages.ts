import { log } from "@/lib/logging/log.ts";

export async function settleDownloadStages(
  cancel: () => Promise<boolean>,
  stages: Array<() => Promise<boolean>>,
): Promise<boolean> {
  let cancellation: Promise<unknown> | undefined;
  const results = await Promise.allSettled(stages.map(async stage => {
    let success = false;

    try {
      success = await stage();

      return success;
    } finally {
      if (!success) {
        cancellation ??= cancel().catch(error => {
          log.warn(__PRE_BUNDLED_FILENAME__, "Download cancellation failed:", String(error));
        });
        await cancellation;
      }
    }
  }));

  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }

  return results.every(result => result.status === "fulfilled" && result.value);
}
