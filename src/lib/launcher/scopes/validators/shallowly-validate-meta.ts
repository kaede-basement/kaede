import type { AssetObjectsType } from "@/types/launcher/artifacts/asset-objects.type.ts";

export function shallowlyValidateMeta({ meta }: { "meta": unknown }): AssetObjectsType | false {
  if (typeof meta !== "object" || meta === null) {
    return false;
  }

  if (!("objects" in meta)) {
    return false;
  }

  return meta as AssetObjectsType;
}
