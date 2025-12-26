import { PatchUIDs } from "@/constants/meta.ts";

export type PatchUIDType = (typeof PatchUIDs)[number];
export type PatchVersionEntryVariantType =
  "release" |
  "snapshot" |
  "experiment" |
  "old_alpha" |
  "old_beta" |
  "old_snapshot";
export type PatchRequiresType = {
  "uid"      : PatchUIDType;
  "equals"  ?: string;
  "suggests"?: string;
};
export type PatchVersionEntryType = {
  "recommended": boolean;
  "releaseTime": string;
  "sha256"     : string;
  "version"    : string;
  "conflicts" ?: Array<PatchRequiresType>;
  "requires"  ?: Array<PatchRequiresType>;
  "type"      ?: PatchVersionEntryVariantType;
  "volatile"  ?: boolean;
};
export type PatchMetaType = {
  "formatVersion": number;
  "name"         : string;
  "uid"          : PatchUIDType;
  "versions"     : Array<PatchVersionEntryType>;
};
