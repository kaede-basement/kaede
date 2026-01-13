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
  // A unique identifier of the dependency
  "uid": PatchUIDType;

  // A version of the dependency that should be selected. Might be missing
  "equals"?: string;

  // A version of the dependency that is recommended. Might be missing
  "suggests"?: string;
};
export type PatchIndexVersionType = {

  /*
   * Whether this version is a recommended one.
   * In Prism Launcher, stars in the version select menu represent this field
   */
  "recommended": boolean;

  // The version release time in the ISO 8601 string format
  "releaseTime": string;

  // An SHA-256 hash that the provided JSON file for this patch version should have
  "sha256": string;

  // A version string, e.g. '26.1-snapshot-2'
  "version": string;

  // An array of conflicted patches. Might be missing
  "conflicts"?: Array<PatchDependencyType>;

  // An array of required patches, i.e. dependencies. Might be missing
  "requires" ?: Array<PatchDependencyType>;

  // Used not only in the 'net.minecraft' patches, but in others too. Might be missing
  "type"?: PatchVariantType;

  // No clue. Might be missing, but present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
export type PatchIndexType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // An array of available patches that are sorted from latest to oldest versions
  "versions": Array<PatchIndexVersionType>;
};
