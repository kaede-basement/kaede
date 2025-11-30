import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function showWebviewWindow(show: boolean | undefined): Promise<void> {
  if (show) {
    const startTime: number | undefined = window[ApplicationNamespace].__internals?.startTime;

    log.debug(
      "User has enabled 'show-after-extensions-initialization';",
      "Showing the webview now",
    );
    await getCurrentWebviewWindow().show();

    const timeDifference: string = startTime === undefined
      ? "-1"
      : (performance.now() - startTime).toFixed(1);

    log.info(
      "Launcher successfully initialized in:",
      timeDifference,
      "ms",
    );
  }
}