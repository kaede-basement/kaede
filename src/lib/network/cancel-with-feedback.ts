import Errors from "@/lib/errors";
import { translate } from "@/lib/general/translate.ts";
import { log } from "@/lib/logging/log.ts";

export async function cancelWithFeedback(
  cancel: () => Promise<unknown>, stillActive: () => boolean,
): Promise<void> {
  try {
    await cancel();
  } catch (error) {
    if (stillActive()) {
      log.error(__PRE_BUNDLED_FILENAME__, "Download cancellation failed:", String(error));
      await Errors.showError(translate("downloads.cancel-error"));
    }
  }
}
