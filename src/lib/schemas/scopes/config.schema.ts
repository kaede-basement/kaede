import { Type } from "typebox";

export const ConfigSchema = Type.Object({
  "customization": Type.Object({
    "theme": Type.Union([
      Type.Literal("light"),
      Type.Literal("dark"),
    ]),
    "accent": Type.Union([
      Type.Literal("red"),
      Type.Literal("orange"),
      Type.Literal("rose"),
    ]),
    "background": Type.String(),
  }),
  "locale": Type.Union([
    Type.Literal("en"),
  ]),
  "minecraftWindowHeight": Type.Number(),
  "minecraftWindowWidth" : Type.Number(),
});