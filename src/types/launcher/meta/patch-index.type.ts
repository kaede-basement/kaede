import { PatchUIDs } from "@/constants/meta.ts";

export type PatchUIDType = (typeof PatchUIDs)[number];
export type PatchVariantType =
  "release" |
  "snapshot" |
  "experiment" |
  "old_alpha" |
  "old_beta" |
  "old_snapshot";
export type PatchDependencyType = {
  "uid"      : PatchUIDType;
  "equals"  ?: string;
  "suggests"?: string;
};
export type PatchIndexVersionType = {
  "recommended": boolean;
  "releaseTime": string;
  "sha256"     : string;
  "version"    : string;
  "conflicts" ?: Array<PatchDependencyType>;
  "requires"  ?: Array<PatchDependencyType>;
  "type"      ?: PatchVariantType;
  "volatile"  ?: boolean;
};
export type PatchIndexType = {
  // Currently, equals to one
  "formatVersion": number;
  // A human-readable name of the patch
  "name"         : string;
  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid"          : PatchUIDType;
  // An array of available patches that are sorted from latest to oldest versions
  "versions"     : Array<PatchIndexVersionType>;
};
