import type {
  ManifestV2ComplianceLevel,
  ManifestV2VersionType,
} from "@/types/launcher/manifest-v2.type.ts";

export type VersionArgumentsType = {
  "game": Array<string>;
  "jvm" : Array<string>;
};
export type VersionAssetIndexType = {
  "id"       : string;
  "sha1"     : string;
  "size"     : number;
  "totalSize": number;
  "url"      : string;
};
export type VersionDownloadsType = {
  "client": {
    "sha1": string;
  };
  "client_mappings": {
    "sha1": string;
  };
  "server": {
    "sha1": string;
  };
  "server_mappings": {
    "sha1": string;
  };
};
export type VersionJavaVersionType = {
  "component": string;
};
export type VersionLibraryType = {
  "name": string;
};
export type VersionLoggingType = {
  "client": {
    "argument": string;
  };
};
export type VersionMetadataType = {
  "arguments"             : VersionArgumentsType;
  "assetIndex"            : VersionAssetIndexType;
  "assets"                : VersionAssetIndexType["id"];
  "complianceLevel"       : ManifestV2ComplianceLevel;
  "downloads"             : VersionDownloadsType;
  "id"                    : string;
  "javaVersion"           : VersionJavaVersionType;
  "libraries"             : Array<VersionLibraryType>;
  "logging"               : VersionLoggingType;
  "mainClass"             : string;
  "minimumLauncherVersion": number;
  "releaseTime"           : string;
  "time"                  : string;
  "type"                  : ManifestV2VersionType;
};