import { showLauncher } from "@/lib/initialization/show-launcher.ts";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";

export async function showWebviewWindow(): Promise<void> {
  if (globalStates.extensions.showAppAfterExtensionsLoad) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User has enabled 'show-app-after-extensions-load';",
      "Showing the webview now",
    );
    await showLauncher();

    log.info(
      __PRE_BUNDLED_FILENAME__,
      "Launcher successfully initialized in:",
      performance.now().toFixed(1),
      "ms",
    );
  }
}
