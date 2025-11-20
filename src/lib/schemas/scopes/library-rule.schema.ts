import Type from "typebox";

export const LibraryRuleSchema = Type.Object({
  "action": Type.Union([
    Type.Literal("allow"),
    Type.Literal("disallow"),
  ]),
  "os": Type.Optional(
    Type.Object({
      "name"   : Type.String(),
      "arch"   : Type.String(),
      "version": Type.String(),
    }),
  ),
});