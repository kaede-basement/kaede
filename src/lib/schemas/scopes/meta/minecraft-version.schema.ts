import { Type } from "typebox";

export const MinecraftVersionSchema = Type.Object({
  "recommended": Type.Boolean(),
  "releaseTime": Type.String(),
  "requires"   : Type.Array(
    Type.Object({
      "suggests": Type.String(),
      "uid"     : Type.String(),
    }),
  ),
  "sha256": Type.String(),
  "type"  : Type.Union([
    Type.Literal("release"),
    Type.Literal("snapshot"),
    Type.Literal("experiment"),
    Type.Literal("old_alpha"),
    Type.Literal("old_beta"),
    Type.Literal("old_snapshot"),
  ]),
  "version": Type.String(),
});
