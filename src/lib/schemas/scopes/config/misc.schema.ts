import { Type } from "typebox";

export const MiscSchema = Type.Object({
  "showAfterExtensionsInitialization": Type.Boolean(),
  "autoConfigSync"                   : Type.Boolean(),
});
