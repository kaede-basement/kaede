import { Type } from "typebox";

export const LayoutSchema = Type.Object({
  "custom"    : Type.Boolean(),
  "background": Type.Object({
    "url": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "key": Type.Union([
      Type.String(),
      Type.Number(),
      Type.Null(),
    ]),
    "blur": Type.Union([
      Type.Number(),
      Type.Null(),
    ]),
    "color": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
  "sidebar": Type.Object({
    "background": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "color": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "blur": Type.Union([
      Type.Number(),
      Type.Null(),
    ]),
    "ripple": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "sparkles": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
  "atAGlance": Type.Object({
    "title": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
    "subtitle": Type.Union([
      Type.String(),
      Type.Null(),
    ]),
  }),
});
