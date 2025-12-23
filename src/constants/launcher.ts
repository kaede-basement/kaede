export const LaunchStatus = {
  "General": {
    "Starting": "starting",
    "Success" : "success",
  },
  "Errors": {
    "UndefinedInstanceVersion"          : "undefined-instance-version",
    "MetaVersionFetchFailed"            : "meta-version-fetch-failed",
    "MetaVersionParseFailed"            : "meta-version-parse-failed",
    "MetaVersionShallowValidationFailed": "meta-version-shallow-validation-failed",
    "MetaVersionFullValidationFailed"   : "meta-version-full-validation-failed",
    "VersionNotFoundInMeta"             : "version-not-found-in-meta",
    "MissingJava"                       : "missing-java",
    "IncorrectJavaVersion"              : "incorrect-java-version",
  },
} as const;
export const LaunchStatusOld = {
  "General": {
    "Starting": "getting-started",
  },
  "ManifestV2": {
    "ReadingCache"    : "reading-cached-manifest-v2",
    "FetchingResponse": "fetching-uncached-manifest-v2",
    "ReadingResponse" : "reading-uncached-manifest-v2",
    "Validating"      : "validating-manifest-v2",
  },
  "VersionMetadata": {
    "ReadingCache"    : "reading-cached-version-metadata",
    "FetchingResponse": "fetching-uncached-version-metadata",
    "ReadingResponse" : "reading-uncached-version-metadata",
    "Validating"      : "validating-version-metadata",
  },
  "End": {
    "Success": "success",
  },
  "Errors": {
    "InvalidManifestV2"          : "invalid-manifest-v2",
    "VersionNotFoundInManifestV2": "version-not-found-in-manifest-v2",
    "MissingJava"                : "missing-java",
    "IncorrectJavaVersion"       : "incorrect-java-version",
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

  /*
   * BMCLAPI: https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json
   * "ManifestV2": "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
   */
} as const;
