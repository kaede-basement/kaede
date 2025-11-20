import Type from "typebox";

export const JavaVersionSchema = Type.Object({
  "component"   : Type.String(),
  "majorVersion": Type.Number(),
});