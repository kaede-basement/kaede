import { FileStructure } from "@/constants/file-structure.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import { regenerateConfigFile } from "@/lib/configs/scopes/regenerate-config-file.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import Schemas from "@/lib/schemas";
import type { ConfigType } from "@/types/configs/config.type.ts";

export async function getConfigFile(passedBaseDirectory?: string): Promise<ConfigType> {
  let baseDirectory: string | undefined = passedBaseDirectory;

  if (!baseDirectory) {
    log.debug("No base directory was passed");
    log.debug("Checking if launcher is in portable version");
    const portable = await General.checkIsPortable();

    log.debug("Getting base directory");
    baseDirectory = await General.getBaseDirectory(portable);
  }

  const configFileDirectory = General.cachedJoin(baseDirectory, FileStructure.Files.Config);

  const hookResponse: "continue" | ConfigType | undefined =
    await ExtensionsManager.catchAsyncBeforeHooks<ConfigType>({
      "scope" : "getConfigFile",
      "toPass": configFileDirectory,
    });

  if (hookResponse !== "continue" && hookResponse !== undefined) {
    return hookResponse;
  }

  const parsedConfig: "continue" | unknown = await General.handleJsonFile({
    baseDirectory,
    "path"           : [FileStructure.Files.Config],
    "label"          : FileStructure.Files.Config,
    "getDefaultValue": getDefaultConfig,
  });

  log.debug("Validating the config file");

  /*
   * If there is additional unknown properties in object, validation will still pass,
   * which is actually good since extensions can use the same config file as the app
   */
  const validatedConfig = Schemas.ConfigValidator.Check(parsedConfig);

  if (!validatedConfig) {
    return regenerateConfigFile({
      baseDirectory,
      configFileDirectory,
    });
  }

  log.info("Config file is valid");

  // Assure TypeScript that the parsed config is valid
  return parsedConfig as ConfigType;
}
