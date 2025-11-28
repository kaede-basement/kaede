import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getSafeConfigFile(baseDirectory?: string): Promise<ConfigType> {
  try {
    log.debug("Getting a config file");

    // Await here to catch errors
    return await Configs.get(baseDirectory);
  } catch (error: unknown) {
    log.error("Failed to get a config file:", Errors.prettify(error));
    log.debug("Getting a default config");

    return Configs.getDefault();
  }
}
