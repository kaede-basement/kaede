import { log } from "@/lib/logging/log.ts";

import { CancelledDownload } from "./download-outcome.ts";

export async function settleDownloadStages(
  cancel: () => Promise<boolean>,
  stages: Array<(signal: AbortSignal) => Promise<boolean>>,
  controller = new AbortController,
): Promise<boolean> {
  let cancellation: Promise<unknown> | undefined;
  const results = await Promise.allSettled(stages.map(async stage => {
    let success = false;

    try {
      success = await stage(controller.signal);


      return success;
    } finally {
      if (!success) {
        cancellation ??= cancel().catch(error => {
          log.warn(__PRE_BUNDLED_FILENAME__, "Download cancellation failed:", String(error));
        });
        controller.abort();
        await cancellation;
      }
    }
  }));

  for (const result of results) {
    if (result.status === "rejected" && !(result.reason instanceof CancelledDownload)) {
      throw result.reason;
    }
  }

  if (results.some(result => result.status === "fulfilled" && !result.value)) {
    return false;
  }
  if (results.some(result => result.status === "rejected")) {
    throw (new CancelledDownload);
  }

  return true;
}
