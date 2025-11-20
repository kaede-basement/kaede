import { Type } from "typebox";

export const MinecraftSchema = Type.Object({
  "windowHeight": Type.Number(),
  "windowWidth" : Type.Number(),
  "jvmArgs"     : Type.String(),
});
