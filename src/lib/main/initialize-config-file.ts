import { BaseDirectory, writeFile } from "@tauri-apps/plugin-fs";
import { ConfigFilename } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { log } from "@/lib/handlers/log.ts";

export async function initializeConfigFile(): Promise<void | Error> {
  log.debug("Encoding default config data");
  // 'writeFile' requires encoded data
  const encoder: TextEncoder = new TextEncoder;
  const data: Uint8Array = encoder.encode(JSON.stringify(
    getDefaultConfig(),
    // Save formatting
    null,
    // With two spaces as an indent
    2,
  ));

  log.debug("Writing the encoded config file");
  await writeFile(ConfigFilename, data, {
    "baseDir": BaseDirectory.AppData,
  });
}
