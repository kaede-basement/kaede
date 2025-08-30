import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { log } from "@/lib/handlers/log.ts";
import { getConfigFile } from "@/lib/main/get-config-file.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import type { ConfigType } from "@/types/config/config.schema.ts";

export async function initializeLauncher(): Promise<void> {
  let config: ConfigType;

  try {
    log.debug("Getting a config file");
    config = await getConfigFile();
  } catch (error: unknown) {
    log.error("Failed to get a config file:", JSON.stringify(error));
    log.debug("Getting default config");
    config = await getDefaultConfig();
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
