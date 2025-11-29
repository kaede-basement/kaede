import type { ManifestV2Type } from "@/types/launcher/manifest-v2.type.ts";

// Clearly, validating 250+ KBs of data with TypeBox will be overkill
export function shallowValidateManifestV2(manifest: unknown): ManifestV2Type | false {
  if (typeof manifest !== "object" || manifest === null) {
    return false;
  }

  const hasLatest = "latest" in manifest;
  const hasVersions = "versions" in manifest;

  if (!hasLatest || !hasVersions) {
    return false;
  }

  const versions: unknown = manifest.versions;
  const hasVersionEntries =
    Array.isArray(versions) &&
    versions.length > 0;

  if (!hasVersionEntries) {
    return false;
  }

  const version: unknown = versions[0];

  const hasVersionId =
    typeof version === "object" &&
    version !== null &&
    "id" in version;

  if (!hasVersionId) {
    return false;
  }

  // Assure TypeScript that this is enough validation
  return manifest as ManifestV2Type;
}