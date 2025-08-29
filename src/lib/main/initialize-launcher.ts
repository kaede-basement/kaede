import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function initializeLauncher(): Promise<void> {
  /*
   * Webview window was hidden by default, so make it visible now
   * Because frontend is already loaded by this time
   */
  await getCurrentWebviewWindow().show();
}
