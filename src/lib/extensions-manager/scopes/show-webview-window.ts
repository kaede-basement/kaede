import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { GlobalInternals } from "@/extendable/global-internals.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function showWebviewWindow(show: boolean | undefined): Promise<void> {
  if (show) {
    const startTime: number | undefined = GlobalInternals?.startTime;

    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User has enabled 'show-after-extensions-initialization';",
      "Showing the webview now",
    );
    await getCurrentWebviewWindow().show();

    const timeDifference: string = startTime === undefined
      ? "-1"
      : (performance.now() - startTime).toFixed(1);

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Launcher successfully initialized in:",
      timeDifference,
      "ms",
    );
  }
}
