import { safeComponent } from "@/lib/cache/storage.ts";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function validDependencies(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(dep => {
    return dep && typeof dep.uid === "string" && optionalString(dep.equals)
      && optionalString(dep.suggests);
  }));
}

export function validPatchIndex(value: unknown): value is Pick<PatchIndexType, "versions"> {
  if (!value || typeof value !== "object" || !("versions" in value)) return false;
  const rows = value.versions;

  if (!Array.isArray(rows) || rows.length === 0) return false;

  return rows.every(row => {
    return row && safeComponent(row.version) && !row.version.includes("..")
      && typeof row.releaseTime === "string"
      && typeof row.sha256 === "string" && (/^[\da-f]{64}$/i).test(row.sha256)
      && typeof row.recommended === "boolean" && optionalString(row.type)
      && validDependencies(row.requires) && validDependencies(row.conflicts);
  });
}
