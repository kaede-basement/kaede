import { Type } from "typebox";

export const RequireSchema = Type.Object({
  "suggests": Type.String(),
  "uid"     : Type.String(),
});
