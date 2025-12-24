export const LaunchStatus = {
  "General": {
    "Starting": "starting",
    "Success" : "success",
  },
  "Metadata": {
    "ReadingCachedVersionMeta": "meta-reading-cached-version-meta",
    "FetchingVersionMeta"     : "meta-fetching-version-meta",
    "ValidatingVersionMeta"   : "meta-validating-version-meta",
  },
  "Assets": {
    "ReadingCachedMeta": "assets-reading-cached-meta",
    "FetchingMeta"     : "assets-fetching-meta",
    "Done"             : "assets-done",
  },
  "Errors": {
    "UndefinedInstanceVersion"          : "error-undefined-instance-version",
    "MetaVersionFetchFailed"            : "error-meta-version-fetch-failed",
    "MetaVersionParseFailed"            : "error-meta-version-parse-failed",
    "MetaVersionShallowValidationFailed": "error-meta-version-shallow-validation-failed",
    "MetaVersionFullValidationFailed"   : "error-meta-version-full-validation-failed",
    "MetaAssetsFetchFailed"             : "error-meta-assets-fetch-failed",
    "MetaAssetsParseFailed"             : "error-meta-assets-parse-failed",
    "MetaAssetsShallowValidationFailed" : "error-meta-assets-shallow-validation-failed",
    "VersionNotFoundInMeta"             : "error-version-not-found-in-meta",
    "MissingJava"                       : "error-missing-java",
    "IncorrectJavaVersion"              : "error-incorrect-java-version",
  },
} as const;
export const APIEndpoints = {
  "Meta": {
    "Base" : "https://meta.prismlauncher.org/v1/",
    "Paths": {
      "Minecraft": {
        "id"  : "net.minecraft",
        "Base": "net.minecraft/",
      },
    },
  },
  "Resources": {
    "Base": "https://resources.download.minecraft.net/",
  },

  /*
   * BMCLAPI: https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json
   * "ManifestV2": "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
   */
} as const;
export const ConcurrentDownloads = {
  "Assets": 64,
} as const;
