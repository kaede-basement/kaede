import { Type } from "typebox";

export const LayoutSchema = Type.Object({
  "custom"    : Type.Boolean(),
  "background": Type.Partial(Type.Object({
    "url": Type.String(),
    "key": Type.Union([
      Type.String(),
      Type.Number(),
    ]),
    "blur" : Type.Number(),
    "color": Type.String(),
  })),
  "sidebar": Type.Partial(Type.Object({
    "background": Type.String(),
    "color"     : Type.String(),
    "blur"      : Type.Number(),
    "ripple"    : Type.String(),
    "sparkles"  : Type.String(),
  })),
});
