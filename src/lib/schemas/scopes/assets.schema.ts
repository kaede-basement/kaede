import Type from "typebox";

import { AssetSchema } from "@/lib/schemas/scopes/asset.schema.ts";

export const AssetsSchema = Type.Object({
  "objects": Type.Array(AssetSchema),
});