import { BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";

import { FileStructure } from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export async function initializeConfigFile(): Promise<void> {
  log.debug("Getting default config");
  const defaultConfig = await getDefaultConfig();

  log.debug("Encoding default config data");
  // 'writeFile' requires encoded data
  const encoder: TextEncoder = new TextEncoder;
  const data: Uint8Array = encoder.encode(JSON.stringify(
    defaultConfig,
    // Save formatting
    null,
    // With two spaces as an indent
    2,
  ));

  log.debug("Writing the encoded config file");
  await writeFile(FileStructure.Config.Name, data, {
    "baseDir": BaseDirectory.AppData,
  });
}
