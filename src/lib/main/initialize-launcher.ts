import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { log } from "@/lib/handlers/log.ts";

export async function initializeLauncher(): Promise<void | Error> {


  /*
   * Webview window was hidden by default, so make it visible now
   * Because frontend is already loaded by this time
   */
  log.debug("Making current webview window visible");
  await getCurrentWebviewWindow().show();

  log.info("Launcher successfully started");
}
