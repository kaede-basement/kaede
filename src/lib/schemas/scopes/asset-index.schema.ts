import Type from "typebox";

export const AssetIndexSchema = Type.Object({
  "id"       : Type.String(),
  "sha1"     : Type.String(),
  "size"     : Type.Number(),
  "totalSize": Type.Number(),
  "url"      : Type.String(),
});