import { Type } from "typebox";
import { Compile } from "typebox/compile";

export const ConfigSchema = Type.Object({
  "__do_not_touch_VERSION": Type.Number(),
  "customization"         : Type.Object({
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
export const ConfigValidator = Compile(ConfigSchema);
