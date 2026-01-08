export const LaunchStatus = {
  "General": {
    "Starting": "general-pending-starting",
    "Aborted" : "general-aborted",
    "Success" : "general-success",
  },
  "PatchIndex": {
    "Reading"         : "patch-index-pending-reading",
    "Fetching"        : "patch-index-pending-fetching",
    "FailedToFetch"   : "patch-index-error-fetch",
    "FailedToParse"   : "patch-index-error-parse",
    "FailedToValidate": "patch-index-error-validation",
    "Success"         : "patch-index-success",
  },
  "PatchMetadata": {
    "Reading"         : "patch-metadata-pending-reading",
    "Fetching"        : "patch-metadata-pending-fetching",
    "FailedToFetch"   : "patch-metadata-error-fetch",
    "FailedToParse"   : "patch-metadata-error-parse",
    "FailedToValidate": "patch-metadata-error-validation",
    "Success"         : "patch-metadata-success",
  },
  "AssetIndex": {
    "Reading"         : "asset-index-pending-reading",
    "Fetching"        : "asset-index-pending-fetching",
    "FailedToFetch"   : "asset-index-error-fetch",
    "FailedToParse"   : "asset-index-error-parse",
    "FailedToValidate": "asset-index-error-validation",
    "Success"         : "asset-index-success",
  },
} as const;
export const _LaunchStatus = {
  "General": {
    "Starting": "general-starting",
    "Success" : "general-success",
  },
  "Patches": {
    "ReadingLatestVersion" : "patches-reading-latest-version",
    "FetchingLatestVersion": "patches-fetching-latest-version",
    "Done"                 : "patches-done",
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
  "Libraries": {
    "DownloadingLibrary": "libraries-downloading-library",
    "Done"              : "libraries-done",
  },
  "Errors": {
    "UnhandledError"                    : "error-unhandled-error",
    "UndefinedInstanceVersion"          : "error-undefined-instance-version",
    "IncompatiblePlatform"              : "error-incompatible-platform",
    "IncompatibleArch"                  : "error-incompatible-arch",
    "MetaVersionFetchFailed"            : "error-meta-version-fetch-failed",
    "MetaVersionParseFailed"            : "error-meta-version-parse-failed",
    "MetaVersionShallowValidationFailed": "error-meta-version-shallow-validation-failed",
    "MetaVersionFullValidationFailed"   : "error-meta-version-full-validation-failed",
    "MetaAssetsMissingMeta"             : "error-meta-assets-missing-meta",
    "MetaAssetsFetchFailed"             : "error-meta-assets-fetch-failed",
    "MetaAssetsParseFailed"             : "error-meta-assets-parse-failed",
    "MetaAssetsShallowValidationFailed" : "error-meta-assets-shallow-validation-failed",
    "ClientMainJarMissingMeta"          : "error-client-main-jar-missing-meta",
    "LoggingMissingMeta"                : "error-logging-missing-meta",
    "PatchMissingMeta"                  : "error-patch-missing-meta",
    "PatchFullValidationFailed"         : "error-patch-full-validation-failed",
    "LibrariesMissingMeta"              : "error-libraries-missing-meta",
    "LibraryShallowValidationFailed"    : "error-library-shallow-validation-failed",
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
        "Id"  : "net.minecraft",
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
  "Assets"   : 64,
  "Libraries": 8,
} as const;
