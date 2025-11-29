export type ManifestV2ComplianceLevel = 0 | 1;
export type ManifestV2VersionType = "release" | "snapshot" | "old_beta" | "old_alpha";
export type ManifestV2Type = {
  "latest": {
    "release" : string;
    "snapshot": string;
  };
  "versions": Array<{
    "id"             : string;
    "type"           : ManifestV2VersionType;
    "url"            : string;
    "time"           : string;
    "releaseTime"    : string;
    "sha1"           : string;
    "complianceLevel": ManifestV2ComplianceLevel;
  }>;
};