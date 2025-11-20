import { Type } from "typebox";

export const DevelopmentSchema = Type.Object({
  "showFPS"                   : Type.Boolean(),
  "enableDebugMode"           : Type.Boolean(),
  "enableNativeReloadKeyBinds": Type.Boolean(),
});
