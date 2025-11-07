import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import Configs from "@/lib/configs";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/application/config.type.ts";

export async function initializeLauncher(): Promise<void> {
  let config: ConfigType;

  try {
    log.debug("Getting a config file");
    config = await Configs.get();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", JSON.stringify(error));
    log.debug("Getting default config");
    config = await Configs.getDefault();
  }

  log.info(JSON.stringify(config));

  /*
   * Webview window was hidden by default, so make it visible now
   * Because frontend is already loaded by this time
   */
  log.debug("Making current webview window visible");
  await getCurrentWebviewWindow().show();

  log.info("Launcher successfully started");
}
