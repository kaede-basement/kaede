import { Type } from "typebox";

export const LogsSchema = Type.Object({
  "show"       : Type.Boolean(),
  "lineBreaks" : Type.Boolean(),
  "virtualized": Type.Boolean(),
  "mode"       : Type.String(),
  "filtering"  : Type.String(),
});
