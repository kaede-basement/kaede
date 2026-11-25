import { message } from "@tauri-apps/plugin-dialog";

import { log } from "@/lib/logging/log.ts";

export async function showError(description: string): Promise<void> {
  try {
    await message(description, { "kind": "error" });
  } catch (error) {
    log.error(
      __PRE_BUNDLED_FILENAME__, "Could not display error dialog:", description, String(error),
    );
  }
}
