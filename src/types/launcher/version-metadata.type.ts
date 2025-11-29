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
  "client_mappings": {};
  "server"         : {};
  "server_mappings": {};
};
export type VersionMetadataType = {
  "arguments"             : VersionArgumentsType;
  "assetIndex"            : VersionAssetIndexType;
  "assets"                : VersionAssetIndexType["id"];
  "complianceLevel"       : ManifestV2ComplianceLevel;
  "downloads"             : {};
  "id"                    : string;
  "javaVersion"           : {};
  "libraries"             : Array<{}>;
  "logging"               : {};
  "mainClass"             : string;
  "minimumLauncherVersion": number;
  "releaseTime"           : string;
  "time"                  : string;
  "type"                  : ManifestV2VersionType;
};