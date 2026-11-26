import { invoke } from "@tauri-apps/api/core";

import Browser from "@/lib/browser";

let supportsStorage = true;

export async function checkWailsStorage(): Promise<void> {
  // Older bridges log unknown commands together with their arguments.
  supportsStorage = await invoke("supports_atomic_storage") === true;
}

export function hasNativeStorage(): boolean {
  return supportsStorage && !Browser.detectIsBrowser();
}
