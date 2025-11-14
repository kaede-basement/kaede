import { Type } from "typebox";

export const DevelopmentSchema = Type.Object({
  "enabled"                   : Type.Boolean(),
  "showFPS"                   : Type.Boolean(),
  "enableDebugMode"           : Type.Boolean(),
  "enableNativeReloadKeyBinds": Type.Boolean(),
});
