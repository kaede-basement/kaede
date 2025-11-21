import { Type } from "typebox";

export const MiscSchema = Type.Object({
  "showAfterExtensionsInitialization": Type.Boolean(),
  "enableDiscordRPC"                 : Type.Boolean(),
  "autoConfigSync"                   : Type.Boolean(),
});
