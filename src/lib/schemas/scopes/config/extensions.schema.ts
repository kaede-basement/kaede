import { Type } from "typebox";

export const ExtensionsSchema = Type.Object({
  "enabled"                   : Type.Boolean(),
  "allowUnrestrictedUntrusted": Type.Boolean(),
});
