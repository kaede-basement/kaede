export const LaunchStatus = {
  "General": {
    "Starting": "general-starting",
    "Success" : "general-success",
  },
  "Metadata": {
    "ReadingCachedVersionMeta": "meta-reading-cached-version-meta",
    "FetchingVersionMeta"     : "meta-fetching-version-meta",
    "ValidatingVersionMeta"   : "meta-validating-version-meta",
    "ReadingCachedPatchMeta"  : "meta-reading-cached-patch-meta",
    "FetchingPatchMeta"       : "meta-fetching-patch-meta",
  },
  "Assets": {
    "ReadingCachedMeta": "assets-reading-cached-meta",
    "FetchingMeta"     : "assets-fetching-meta",
    "DownloadingAsset" : "assets-downloading-asset",
    "Done"             : "assets-done",
  },
  "Client": {
    "CheckingIfPresent": "client-checking-if-present",
    "DownloadingJar"   : "client-downloading-jar",
    "Done"             : "client-done",
  },
  "Logging": {
    "CheckingIfPresent": "logging-checking-if-present",
    "DownloadingConfig": "logging-downloading-config",
    "Done"             : "logging-done",
  },
  "Errors": {
    "UnhandledError"                    : "error-unhandled-error",
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
