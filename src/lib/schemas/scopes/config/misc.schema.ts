import { Type } from "typebox";

export const MiscSchema = Type.Object({
  "showBeforeInitialization": Type.Boolean(),
  "enableDiscordRPC"        : Type.Boolean(),
});
