import Configs from "@/lib/configs";
import Errors from "@/lib/errors";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getSafeConfigFile(baseDirectory?: string): Promise<ConfigType> {
  try {
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting a config file");

    // Await here to catch errors
    return await Configs.get(
      baseDirectory ?? General.getCachedBaseDirectory(),
    );
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to get a config file:",
      Errors.prettify(error),
    );
    log.debug(__PRE_BUNDLED_FILENAME__, "Getting a default config");

    return Configs.getDefault();
  }
}
