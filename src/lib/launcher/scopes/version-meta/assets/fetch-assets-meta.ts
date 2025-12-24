import type { AssetObjectsType } from "@/types/launcher/assets/asset-objects.type.ts";
import type { LaunchStatusType } from "@/types/launcher/launch-status.type.ts";

export async function fetchAssetsMeta({
  filePath,
  url,
  assetIndex,
}: {
  "filePath"  : string;
  "url"       : string;
  "assetIndex": string;
}): Promise<AssetObjectsType | LaunchStatusType> {

}
