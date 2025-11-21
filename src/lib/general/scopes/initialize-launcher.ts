import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

export async function initializeLauncher(
  config: ConfigType,
  startTime: number,
): Promise<void> {
  if (!config.misc.showAfterExtensionsInitialization) {
    /*
     * Webview window is still hidden, so make it visible now
     * Because frontend is already loaded by this time
     */
    log.debug("Making current webview window visible");
    await getCurrentWebviewWindow().show();
  }

  log.info(
    "Launcher successfully started in:",
    (performance.now() - startTime).toFixed(1),
    "ms",
  );
}
