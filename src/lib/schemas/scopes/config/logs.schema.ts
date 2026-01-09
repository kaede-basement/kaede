import { Type } from "typebox";

export const LogsSchema = Type.Object({
  "show"       : Type.Boolean(),
  "lineBreaks" : Type.Boolean(),
  "virtualized": Type.Boolean(),
  "filtering"  : Type.String(),
});
