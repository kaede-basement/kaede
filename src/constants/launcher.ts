export const LaunchStatus = {
  "General": {
    "Starting": "getting-started",
  },
  "ManifestV2": {
    "ReadingCache"    : "reading-cached-manifest-v2",
    "FetchingResponse": "fetching-uncached-manifest-v2",
    "ReadingResponse" : "reading-uncached-manifest-v2",
    "Validating"      : "validating-manifest-v2",
  },
  "VersionManifest": {
    "ReadingCache": "reading-cached-version-manifest",
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
  // BMCLAPI: https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json
  "ManifestV2": "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
} as const;