import Type from "typebox";

export const AssetSchema = Type.Object({
  "hash": Type.String(),
  "size": Type.Number(),
});