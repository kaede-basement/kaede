import Type from "typebox";
import { Compile } from "typebox/compile";

export const AssetIndexSchema = Type.Object({
  "id"       : Type.String(),
  "sha1"     : Type.String(),
  "size"     : Type.Number(),
  "totalSize": Type.Number(),
  "url"      : Type.String(),
});
export const AssetIndexValidator = Compile(AssetIndexSchema);