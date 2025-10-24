import { Type, type Static } from "typebox";

// eslint-disable-next-line unicorn/no-abusive-eslint
// eslint-disable-next-line
// @ts-ignore
import { TypeCompiler } from "typebox/compiler";

const ConfigSchema = Type.Object({
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
  "locale"               : Type.String(),
  "minecraftWindowHeight": Type.Number(),
  "minecraftWindowWidth" : Type.Number(),
});

export const ConfigValidator = TypeCompiler.Compile(ConfigSchema);
export type ConfigType = Static<typeof ConfigSchema>;
