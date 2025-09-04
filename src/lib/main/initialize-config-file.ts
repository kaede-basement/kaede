import { ConfigFilename } from "@/constants/application.ts";
import { getDefaultConfig } from "@/lib/main/get-default-config.ts";
import { log } from "@/lib/handlers/log.ts";
const { BaseDirectory, writeFile } = window.__TAURI__.fs;

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
  await writeFile(ConfigFilename, data, {
    "baseDir": BaseDirectory.AppData,
  });
}
